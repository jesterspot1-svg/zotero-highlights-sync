import {
  type App,
  Notice,
  Plugin,
  TFile
} from "obsidian";

import {
  AtomicNoteError,
  createAtomicNote,
  createBookNotes,
  findAtomicNote,
  findAtomicNotesForAttachment,
  markAtomicNoteSourceDeleted,
  NoteCreationError,
  updateAtomicNote
} from "./notes";
import {
  PdfStructureError,
  restoreAnnotationsTextStructure
} from "./pdf";
import {
  DEFAULT_SETTINGS,
  type ZoteroHighlightsSyncSettings
} from "./settings";
import {
  AnnotationSyncError,
  type AnnotationSyncResult,
  readAnnotationNumbers,
  synchronizeAnnotationsContent
} from "./sync";
import { TemplateError } from "./templates";
import { ZoteroHighlightsSyncSettingTab } from "./settings-tab";
import {
  ZoteroBookSuggestModal,
  ZoteroPdfSuggestModal
} from "./ui";
import {
  type ZoteroAnnotation,
  type ZoteroBook,
  ZoteroClient,
  ZoteroConnectionError,
  type ZoteroPdfAttachment
} from "./zotero";

interface AtomicSyncSummary {
  total: number;
  updated: number;
  deleted: number;
  failed: string[];
}

interface CompletedAnnotationsSync {
  annotations: ZoteroAnnotation[];
  result: AnnotationSyncResult;
  atomic: AtomicSyncSummary;
  structureWarning: string | null;
}

export default class ZoteroHighlightsSyncPlugin extends Plugin {
  settings: ZoteroHighlightsSyncSettings = DEFAULT_SETTINGS;
  private readonly zoteroClient = new ZoteroClient();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new ZoteroHighlightsSyncSettingTab(this.app, this));

    this.addCommand({
      id: "create-book",
      name: "Создание книги",
      callback: () => {
        void this.openBookPicker();
      }
    });

    this.addCommand({
      id: "check-zotero-connection",
      name: "Проверить соединение с Zotero",
      callback: () => {
        void this.checkZoteroConnection();
      }
    });

    this.addCommand({
      id: "inspect-current-book-annotations",
      name: "Проверить пометки текущей книги",
      checkCallback: (checking) => {
        if (this.getActiveAttachmentKey() === null) {
          return false;
        }

        if (!checking) {
          void this.inspectCurrentBookAnnotations();
        }

        return true;
      }
    });

    this.addCommand({
      id: "create-all-atomic-notes",
      name: "Создать отдельные заметки для всех пометок",
      checkCallback: (checking) => {
        if (this.getActiveAnnotationsNote() === null) {
          return false;
        }

        if (!checking) {
          void this.createAllAtomicNotes();
        }

        return true;
      }
    });

    this.registerMarkdownCodeBlockProcessor(
      "zhs-annotations-toolbar",
      (source, el, context) => {
        const attachmentKey = readCodeBlockProperty(
          source,
          "attachment_key"
        );
        const toolbar = el.createDiv({
          cls: "zhs-annotations-toolbar"
        });
        const updateButton = toolbar.createEl("button", {
          cls: "mod-cta",
          text: "Обновить пометки"
        });

        if (attachmentKey === null) {
          updateButton.disabled = true;
          toolbar.createSpan({
            cls: "zhs-toolbar-error",
            text: "В служебном блоке отсутствует ключ PDF Zotero"
          });
          return;
        }

        updateButton.addEventListener("click", () => {
          void this.runToolbarSync(
            context.sourcePath,
            attachmentKey,
            updateButton
          );
        });
      }
    );

    this.registerMarkdownCodeBlockProcessor(
      "zhs-annotation-actions",
      (source, el, context) => {
        const annotationKey = readCodeBlockProperty(
          source,
          "annotation_key"
        );
        const attachmentKey = readCodeBlockProperty(
          source,
          "attachment_key"
        );
        const annotationNumberText = readCodeBlockProperty(
          source,
          "annotation_number"
        );
        const annotationNumber = annotationNumberText === null
          ? Number.NaN
          : Number.parseInt(annotationNumberText, 10);

        if (
          annotationKey === null
          || attachmentKey === null
          || !Number.isSafeInteger(annotationNumber)
          || annotationNumber < 1
        ) {
          el.createSpan({
            cls: "zhs-toolbar-error",
            text: "Некорректные данные кнопок пометки"
          });
          return;
        }

        void this.renderAnnotationActions(
          el,
          context.sourcePath,
          annotationKey,
          attachmentKey,
          annotationNumber
        );
      }
    );
  }

  async loadSettings(): Promise<void> {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(await this.loadData() as Partial<ZoteroHighlightsSyncSettings> | null)
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async openBookPicker(): Promise<void> {
    try {
      const books = await this.zoteroClient.getBooks();

      if (books.length === 0) {
        new Notice("В личной библиотеке Zotero не найдено книг");
        return;
      }

      new ZoteroBookSuggestModal(this.app, books, (book) => {
        void this.openPdfPicker(book);
      }).open();
    } catch (error: unknown) {
      this.showZoteroConnectionError(error);
    }
  }

  private async openPdfPicker(book: ZoteroBook): Promise<void> {
    try {
      const attachments = await this.zoteroClient.getPdfAttachments(book.key);

      if (attachments.length === 0) {
        new Notice(
          `У книги «${book.title}» нет PDF-вложения в Zotero`,
          8000
        );
        return;
      }

      if (attachments.length === 1) {
        const attachment = attachments[0];
        if (attachment !== undefined) {
          this.handleBookAndPdfSelection(book, attachment);
        }
        return;
      }

      new ZoteroPdfSuggestModal(this.app, attachments, (attachment) => {
        this.handleBookAndPdfSelection(book, attachment);
      }).open();
    } catch (error: unknown) {
      this.showZoteroConnectionError(error);
    }
  }

  private handleBookAndPdfSelection(
    book: ZoteroBook,
    attachment: ZoteroPdfAttachment
  ): void {
    void this.createNotesForBook(book, attachment);
  }

  private async createNotesForBook(
    book: ZoteroBook,
    attachment: ZoteroPdfAttachment
  ): Promise<void> {
    try {
      const totalPages = book.totalPages.length > 0
        ? book.totalPages
        : await this.zoteroClient.getAttachmentPageCount(attachment.key);
      const bookWithPages: ZoteroBook = {
        ...book,
        totalPages
      };
      const result = await createBookNotes(
        this.app.vault,
        this.settings,
        bookWithPages,
        attachment
      );
      await this.fillMissingAllPages(result.bookFile, totalPages);
      await this.app.workspace.getLeaf(false).openFile(result.bookFile);

      if (!result.bookCreated && !result.annotationsCreated) {
        new Notice("Заметки этой книги уже существуют — открыта заметка книги");
        return;
      }

      const created: string[] = [];
      if (result.bookCreated) {
        created.push("заметка книги");
      }
      if (result.annotationsCreated) {
        created.push("заметка с пометками");
      }

      new Notice(`Создано: ${created.join(" и ")}`, 7000);
    } catch (error: unknown) {
      if (error instanceof TemplateError || error instanceof NoteCreationError) {
        new Notice(error.message, 10000);
        return;
      }

      const message = error instanceof Error
        ? error.message
        : "Неизвестная ошибка";
      new Notice(`Не удалось создать заметки: ${message}`, 10000);
    }
  }

  private async fillMissingAllPages(
    bookFile: TFile,
    totalPages: string
  ): Promise<void> {
    if (totalPages.length === 0) {
      return;
    }

    await this.app.fileManager.processFrontMatter(
      bookFile,
      (frontmatter: Record<string, unknown>) => {
        const existing = frontmatter.allpages;
        if (
          (typeof existing === "string" && existing.trim().length > 0)
          || typeof existing === "number"
        ) {
          return;
        }

        const numericPages = Number.parseInt(totalPages, 10);
        frontmatter.allpages = Number.isSafeInteger(numericPages)
          ? numericPages
          : totalPages;
      }
    );
  }

  private async checkZoteroConnection(): Promise<void> {
    try {
      const books = await this.zoteroClient.getBooks();
      new Notice(`Соединение с Zotero установлено. Книг: ${books.length}`);
    } catch (error: unknown) {
      this.showZoteroConnectionError(error);
    }
  }

  private async inspectCurrentBookAnnotations(): Promise<void> {
    const attachmentKey = this.getActiveAttachmentKey();
    if (attachmentKey === null) {
      new Notice(
        "Откройте заметку книги или заметку с пометками, содержащую ключ PDF Zotero",
        9000
      );
      return;
    }

    try {
      const annotations = await this.zoteroClient.getAnnotations(attachmentKey);
      const withText = annotations.filter(
        (annotation) => annotation.text.length > 0
      ).length;
      const withComments = annotations.filter(
        (annotation) => annotation.comment.length > 0
      ).length;

      new Notice(
        `Zotero вернул пометок: ${annotations.length}. `
        + `С текстом: ${withText}. С комментариями: ${withComments}.`,
        10000
      );
    } catch (error: unknown) {
      this.showZoteroConnectionError(error);
    }
  }

  private async runToolbarSync(
    sourcePath: string,
    attachmentKey: string,
    button: HTMLButtonElement
  ): Promise<void> {
    button.disabled = true;
    button.setText("Обновление…");

    try {
      await this.synchronizeAnnotationsNote(sourcePath, attachmentKey);
    } finally {
      button.disabled = false;
      button.setText("Обновить пометки");
    }
  }

  private async synchronizeAnnotationsNote(
    sourcePath: string,
    attachmentKey: string
  ): Promise<void> {
    const note = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(note instanceof TFile) || note.extension !== "md") {
      new Notice("Не удалось найти общую заметку с пометками", 8000);
      return;
    }

    try {
      const sync = await this.performAnnotationsSync(note, attachmentKey);
      const atomicText = sync.atomic.total === 0
        ? ""
        : ` Отдельных заметок обновлено: ${sync.atomic.updated}; `
          + `источник удалён: ${sync.atomic.deleted}.`
          + (sync.atomic.failed.length > 0
            ? ` Не удалось обновить: ${sync.atomic.failed.join(", ")}.`
            : "");

      new Notice(
        `Пометки обновлены: ${sync.result.count}. `
        + `Новых: ${sync.result.added}, изменённых: `
        + `${sync.result.changed}, удалённых: ${sync.result.removed}.`
        + atomicText
        + (sync.structureWarning === null
          ? ""
          : ` ${sync.structureWarning}`),
        14000
      );
    } catch (error: unknown) {
      if (error instanceof AnnotationSyncError) {
        new Notice(error.message, 10000);
        return;
      }

      this.showZoteroConnectionError(error);
    }
  }

  private async performAnnotationsSync(
    note: TFile,
    attachmentKey: string
  ): Promise<CompletedAnnotationsSync> {
    const annotations = await this.zoteroClient.getAnnotations(attachmentKey);
    const pdfPath = await this.zoteroClient.getAttachmentFilePath(
      attachmentKey
    );
    let annotationsWithStructure = annotations;
    let structureWarning: string | null = null;

    try {
      annotationsWithStructure = await restoreAnnotationsTextStructure(
        pdfPath,
        annotations
      );
    } catch (error: unknown) {
      if (error instanceof PdfStructureError) {
        structureWarning = error.message;
      } else {
        structureWarning = "Не удалось восстановить структуру текста PDF.";
      }
    }

    let syncResult: AnnotationSyncResult = synchronizeAnnotationsContent(
      await this.app.vault.cachedRead(note),
      annotationsWithStructure,
      attachmentKey
    );

    await this.app.vault.process(note, (currentContent) => {
      syncResult = synchronizeAnnotationsContent(
        currentContent,
        annotationsWithStructure,
        attachmentKey
      );
      return syncResult.content;
    });

    const completedSync = syncResult;
    await this.app.fileManager.processFrontMatter(
      note,
      (frontmatter: Record<string, unknown>) => {
        frontmatter.annotations_count = completedSync.count;
        frontmatter.last_sync = formatLocalDateTime(new Date());
      }
    );
    const atomicSync = await this.updateExistingAtomicNotes(
      note,
      attachmentKey,
      annotationsWithStructure,
      completedSync.content
    );

    return {
      annotations: annotationsWithStructure,
      result: completedSync,
      atomic: atomicSync,
      structureWarning
    };
  }

  private async updateExistingAtomicNotes(
    annotationsFile: TFile,
    attachmentKey: string,
    annotations: ZoteroAnnotation[],
    synchronizedContent: string
  ): Promise<AtomicSyncSummary> {
    const atomicNotes = findAtomicNotesForAttachment(this.app, attachmentKey);
    const annotationsByKey = new Map(
      annotations.map((annotation) => [
        annotation.key,
        annotation
      ])
    );
    const annotationNumbers = readAnnotationNumbers(synchronizedContent);
    let updated = 0;
    let deleted = 0;
    const failed: string[] = [];

    for (const atomicNote of atomicNotes) {
      try {
        const annotation = annotationsByKey.get(atomicNote.annotationKey);
        if (annotation === undefined) {
          await markAtomicNoteSourceDeleted(this.app, atomicNote.file);
          deleted += 1;
          continue;
        }

        const annotationNumber = annotationNumbers.get(annotation.key)
          ?? atomicNote.annotationNumber;
        if (annotationNumber === null) {
          throw new AtomicNoteError(
            "Не найден порядковый номер пометки."
          );
        }

        await updateAtomicNote(
          this.app,
          annotationsFile,
          atomicNote.file,
          annotation,
          annotationNumber
        );
        updated += 1;
      } catch {
        failed.push(atomicNote.file.basename);
      }
    }

    return {
      total: atomicNotes.length,
      updated,
      deleted,
      failed
    };
  }

  private async createAllAtomicNotes(): Promise<void> {
    const annotationsFile = this.getActiveAnnotationsNote();
    if (annotationsFile === null) {
      new Notice(
        "Откройте заметку книги или общую заметку с пометками",
        8000
      );
      return;
    }

    const attachmentKey = readFileFrontmatterString(
      this.app,
      annotationsFile,
      "zotero_attachment_key"
    );
    if (attachmentKey.length === 0) {
      new Notice("В общей заметке отсутствует ключ PDF Zotero", 8000);
      return;
    }

    try {
      const sync = await this.performAnnotationsSync(
        annotationsFile,
        attachmentKey
      );
      const annotationNumbers = readAnnotationNumbers(sync.result.content);
      let created = 0;
      let skipped = 0;
      const failed: string[] = [];

      for (const annotation of sync.annotations) {
        if (annotation.text.length === 0 && annotation.comment.length === 0) {
          continue;
        }

        const existing = await findAtomicNote(this.app, annotation.key);
        if (existing !== null) {
          skipped += 1;
          continue;
        }

        const annotationNumber = annotationNumbers.get(annotation.key);
        if (annotationNumber === undefined) {
          failed.push(annotation.key);
          continue;
        }

        try {
          await createAtomicNote(
            this.app,
            this.settings,
            annotationsFile,
            annotation,
            annotationNumber
          );
          created += 1;
        } catch (error: unknown) {
          failed.push(
            `№ ${annotationNumber}: ${getErrorSummary(error)}`
          );
        }
      }

      const warningText = sync.structureWarning === null
        ? ""
        : ` ${sync.structureWarning}`;
      const failureText = failed.length === 0
        ? ""
        : ` Не удалось создать: ${failed.join(", ")}.`;
      new Notice(
        `Создано отдельных заметок: ${created}. `
        + `Уже существовало: ${skipped}.${failureText}${warningText}`,
        14000
      );
    } catch (error: unknown) {
      if (error instanceof AnnotationSyncError) {
        new Notice(error.message, 10000);
        return;
      }

      this.showAtomicNoteError(error);
    }
  }

  private getActiveAnnotationsNote(): TFile | null {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile === null) {
      return null;
    }

    const type = readFileFrontmatterString(
      this.app,
      activeFile,
      "type"
    );
    if (type === "book-annotations") {
      return activeFile;
    }

    if (type !== "book") {
      return null;
    }

    const annotationsLink = readFileFrontmatterString(
      this.app,
      activeFile,
      "annotations-link"
    );
    const linkPath = extractWikiLinkPath(annotationsLink);
    if (linkPath === null) {
      return null;
    }

    return this.app.metadataCache.getFirstLinkpathDest(
      linkPath,
      activeFile.path
    );
  }

  private async renderAnnotationActions(
    container: HTMLElement,
    annotationsPath: string,
    annotationKey: string,
    attachmentKey: string,
    annotationNumber: number
  ): Promise<void> {
    container.empty();
    container.addClass("zhs-annotation-actions");
    const atomicNote = await findAtomicNote(this.app, annotationKey);

    if (atomicNote === null) {
      const createButton = container.createEl("button", {
        text: "Создать заметку"
      });
      createButton.addEventListener("click", () => {
        void this.createAtomicNoteFromAction(
          container,
          annotationsPath,
          annotationKey,
          attachmentKey,
          annotationNumber,
          createButton
        );
      });
      return;
    }

    const openButton = container.createEl("button", {
      text: "Открыть заметку"
    });
    openButton.addEventListener("click", () => {
      void this.app.workspace.getLeaf(false).openFile(atomicNote);
    });

    const updateButton = container.createEl("button", {
      text: "Обновить заметку"
    });
    updateButton.addEventListener("click", () => {
      void this.updateAtomicNoteFromAction(
        container,
        annotationsPath,
        atomicNote,
        annotationKey,
        attachmentKey,
        annotationNumber,
        updateButton
      );
    });
  }

  private async createAtomicNoteFromAction(
    container: HTMLElement,
    annotationsPath: string,
    annotationKey: string,
    attachmentKey: string,
    annotationNumber: number,
    button: HTMLButtonElement
  ): Promise<void> {
    button.disabled = true;
    button.setText("Создание…");

    try {
      const annotationsFile = this.getAnnotationsFile(annotationsPath);
      const annotation = await this.loadStructuredAnnotation(
        attachmentKey,
        annotationKey
      );
      const atomicFile = await createAtomicNote(
        this.app,
        this.settings,
        annotationsFile,
        annotation,
        annotationNumber
      );
      await this.app.workspace.getLeaf(false).openFile(atomicFile);
      new Notice(`Создана заметка: ${atomicFile.basename}`);
      await this.renderAnnotationActions(
        container,
        annotationsPath,
        annotationKey,
        attachmentKey,
        annotationNumber
      );
    } catch (error: unknown) {
      this.showAtomicNoteError(error);
      button.disabled = false;
      button.setText("Создать заметку");
    }
  }

  private async updateAtomicNoteFromAction(
    container: HTMLElement,
    annotationsPath: string,
    atomicFile: TFile,
    annotationKey: string,
    attachmentKey: string,
    annotationNumber: number,
    button: HTMLButtonElement
  ): Promise<void> {
    button.disabled = true;
    button.setText("Обновление…");

    try {
      const annotationsFile = this.getAnnotationsFile(annotationsPath);
      const annotation = await this.loadStructuredAnnotation(
        attachmentKey,
        annotationKey
      );
      await updateAtomicNote(
        this.app,
        annotationsFile,
        atomicFile,
        annotation,
        annotationNumber
      );
      new Notice(`Заметка обновлена: ${atomicFile.basename}`);
      await this.renderAnnotationActions(
        container,
        annotationsPath,
        annotationKey,
        attachmentKey,
        annotationNumber
      );
    } catch (error: unknown) {
      this.showAtomicNoteError(error);
      button.disabled = false;
      button.setText("Обновить заметку");
    }
  }

  private getAnnotationsFile(path: string): TFile {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || file.extension !== "md") {
      throw new AtomicNoteError(
        "Не удалось найти общую заметку с пометками."
      );
    }

    return file;
  }

  private async loadStructuredAnnotation(
    attachmentKey: string,
    annotationKey: string
  ): Promise<ZoteroAnnotation> {
    const annotations = await this.zoteroClient.getAnnotations(attachmentKey);
    const annotation = annotations.find(
      (candidate) => candidate.key === annotationKey
    );
    if (annotation === undefined) {
      throw new AtomicNoteError(
        "Пометка больше не существует в Zotero."
      );
    }

    const pdfPath = await this.zoteroClient.getAttachmentFilePath(
      attachmentKey
    );
    const structured = await restoreAnnotationsTextStructure(
      pdfPath,
      [annotation]
    );
    return structured[0] ?? annotation;
  }

  private showAtomicNoteError(error: unknown): void {
    if (
      error instanceof AtomicNoteError
      || error instanceof TemplateError
      || error instanceof PdfStructureError
    ) {
      new Notice(error.message, 10000);
      return;
    }

    if (error instanceof ZoteroConnectionError) {
      this.showZoteroConnectionError(error);
      return;
    }

    const message = error instanceof Error
      ? error.message
      : "Неизвестная ошибка";
    new Notice(`Не удалось обработать отдельную заметку: ${message}`, 10000);
  }

  private getActiveAttachmentKey(): string | null {
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile === null) {
      return null;
    }

    const frontmatter = this.app.metadataCache
      .getFileCache(activeFile)
      ?.frontmatter;
    const value: unknown = frontmatter?.zotero_attachment_key;

    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : null;
  }

  private showZoteroConnectionError(error: unknown): void {
    if (
      error instanceof ZoteroConnectionError
      && error.failure === "api-disabled"
    ) {
      new Notice(
        "В Zotero включите: Настройки → Расширенные → Разрешить другим приложениям на этом компьютере связываться с Zotero",
        10000
      );
      return;
    }

    if (error instanceof ZoteroConnectionError) {
      new Notice(error.message, 8000);
      return;
    }

    new Notice("Неизвестная ошибка подключения к Zotero", 8000);
  }
}

function readCodeBlockProperty(source: string, property: string): string | null {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pattern = new RegExp(
    `^${escapedProperty}:\\s*([A-Za-z0-9]+)\\s*$`,
    "mu"
  );
  return source.match(pattern)?.[1] ?? null;
}

function formatLocalDateTime(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const offsetHours = String(
    Math.floor(Math.abs(offsetMinutes) / 60)
  ).padStart(2, "0");
  const offsetRemainder = String(
    Math.abs(offsetMinutes) % 60
  ).padStart(2, "0");

  return [
    `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`,
    `${offsetSign}${offsetHours}:${offsetRemainder}`
  ].join("");
}

function readFileFrontmatterString(
  app: App,
  file: TFile,
  property: string
): string {
  const frontmatter: unknown = app.metadataCache
    .getFileCache(file)
    ?.frontmatter;
  if (!isRecord(frontmatter)) {
    return "";
  }

  const value = frontmatter[property];
  return typeof value === "string" ? value.trim() : "";
}

function extractWikiLinkPath(value: string): string | null {
  const match = value.match(/^\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/u);
  const path = match?.[1]?.trim() ?? "";
  return path.length > 0 ? path : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorSummary(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return "неизвестная ошибка";
}
