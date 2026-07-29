import {
  App,
  normalizePath,
  parseYaml,
  TFile
} from "obsidian";

import type { ZoteroHighlightsSyncSettings } from "../settings";
import { renderAtomicAnnotationManagedBlock } from "../sync";
import {
  readTemplate,
  renderTemplate
} from "../templates";
import type {
  ZoteroAnnotation,
  ZoteroBook,
  ZoteroPdfAttachment
} from "../zotero";
import { createAnnotationNoteName } from "./names";

interface AnnotationNoteContext {
  bookName: string;
  annotationsName: string;
  itemKey: string;
  attachmentKey: string;
}

export interface AtomicNoteRecord {
  file: TFile;
  annotationKey: string;
  annotationNumber: number | null;
}

export class AtomicNoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AtomicNoteError";
  }
}

export async function findAtomicNote(
  app: App,
  annotationKey: string
): Promise<TFile | null> {
  for (const file of app.vault.getMarkdownFiles()) {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    const key = readFrontmatterString(frontmatter, "annotation_key");
    if (key === annotationKey) {
      return file;
    }
  }

  return null;
}

export function findAtomicNotesForAttachment(
  app: App,
  attachmentKey: string
): AtomicNoteRecord[] {
  const records: AtomicNoteRecord[] = [];

  for (const file of app.vault.getMarkdownFiles()) {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    const fileAttachmentKey = readFrontmatterString(
      frontmatter,
      "zotero_attachment_key"
    );
    const annotationKey = readFrontmatterString(
      frontmatter,
      "annotation_key"
    );

    if (
      fileAttachmentKey !== attachmentKey
      || annotationKey.length === 0
    ) {
      continue;
    }

    records.push({
      file,
      annotationKey,
      annotationNumber: readFrontmatterNumber(
        frontmatter,
        "annotation_number"
      )
    });
  }

  return records;
}

export async function createAtomicNote(
  app: App,
  settings: ZoteroHighlightsSyncSettings,
  annotationsFile: TFile,
  annotation: ZoteroAnnotation,
  annotationNumber: number
): Promise<TFile> {
  const existing = await findAtomicNote(app, annotation.key);
  if (existing !== null) {
    return existing;
  }

  const context = await readAnnotationNoteContext(app, annotationsFile);
  const template = await readTemplate(
    app.vault,
    settings.annotationTemplatePath,
    "Шаблон отдельной пометки"
  );
  const managedBlock = renderAtomicAnnotationManagedBlock(
    annotation,
    annotationNumber,
    context.attachmentKey
  );
  const rendered = renderTemplate(
    template,
    createTemplateContext(
      context,
      annotation,
      annotationNumber,
      managedBlock
    )
  );
  const notePath = createAvailableAtomicNotePath(
    app,
    annotation.text,
    annotation.key
  );

  return app.vault.create(notePath, ensureTrailingNewline(rendered));
}

export async function updateAtomicNote(
  app: App,
  annotationsFile: TFile,
  atomicFile: TFile,
  annotation: ZoteroAnnotation,
  annotationNumber: number
): Promise<void> {
  const context = await readAnnotationNoteContext(app, annotationsFile);
  const managedBlock = renderAtomicAnnotationManagedBlock(
    annotation,
    annotationNumber,
    context.attachmentKey
  );

  await app.vault.process(atomicFile, (content) => {
    return replaceAtomicManagedBlock(content, managedBlock);
  });
  const annotationLink = [
    `zotero://open-pdf/library/items/${context.attachmentKey}`,
    `?annotation=${annotation.key}`
  ].join("");

  await app.fileManager.processFrontMatter(
    atomicFile,
    (frontmatter: Record<string, unknown>) => {
      frontmatter.type = "book-annotation";
      frontmatter.annotation_number = annotationNumber;
      frontmatter.annotation_key = annotation.key;
      frontmatter.zotero_item_key = context.itemKey;
      frontmatter.zotero_attachment_key = context.attachmentKey;
      frontmatter.page = annotation.pageLabel;
      frontmatter.color = annotation.color;
      frontmatter.date_added = annotation.dateAdded;
      frontmatter.date_modified = annotation.dateModified;
      frontmatter.zotero_link = annotationLink;
      frontmatter.source_deleted = false;
    }
  );
}

export async function markAtomicNoteSourceDeleted(
  app: App,
  atomicFile: TFile
): Promise<void> {
  await app.fileManager.processFrontMatter(
    atomicFile,
    (frontmatter: Record<string, unknown>) => {
      frontmatter.source_deleted = true;
    }
  );
}

async function readAnnotationNoteContext(
  app: App,
  annotationsFile: TFile
): Promise<AnnotationNoteContext> {
  let frontmatter: unknown = app.metadataCache
    .getFileCache(annotationsFile)
    ?.frontmatter;
  let context = extractAnnotationNoteContext(
    frontmatter,
    annotationsFile
  );

  if (
    context.itemKey.length === 0
    || context.attachmentKey.length === 0
    || context.bookName.length === 0
  ) {
    frontmatter = parseFrontmatter(
      await app.vault.cachedRead(annotationsFile)
    );
    context = extractAnnotationNoteContext(frontmatter, annotationsFile);
  }

  if (context.itemKey.length === 0 || context.attachmentKey.length === 0) {
    throw new AtomicNoteError(
      "В общей заметке отсутствуют ключ книги или ключ PDF Zotero."
    );
  }

  if (context.bookName.length === 0) {
    throw new AtomicNoteError(
      "В свойстве links общей заметки отсутствует ссылка на заметку книги."
    );
  }

  return context;
}

function extractAnnotationNoteContext(
  frontmatter: unknown,
  annotationsFile: TFile
): AnnotationNoteContext {
  return {
    bookName: readBookLink(frontmatter),
    annotationsName: annotationsFile.basename,
    itemKey: readFrontmatterString(frontmatter, "zotero_item_key"),
    attachmentKey: readFrontmatterString(
      frontmatter,
      "zotero_attachment_key"
    )
  };
}

function parseFrontmatter(content: string): unknown {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/u);
  const yaml = match?.[1];
  if (yaml === undefined) {
    return null;
  }

  try {
    return parseYaml(yaml) as unknown;
  } catch {
    return null;
  }
}

function readFrontmatterString(
  frontmatter: unknown,
  property: string
): string {
  if (!isRecord(frontmatter)) {
    return "";
  }

  const value = frontmatter[property];
  return typeof value === "string" ? value.trim() : "";
}

function readFrontmatterNumber(
  frontmatter: unknown,
  property: string
): number | null {
  if (!isRecord(frontmatter)) {
    return null;
  }

  const value = frontmatter[property];
  const number = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number.parseInt(value, 10)
      : Number.NaN;

  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function readBookLink(frontmatter: unknown): string {
  if (!isRecord(frontmatter)) {
    return "";
  }

  const links = frontmatter.links;
  const candidates = Array.isArray(links)
    ? links
    : typeof links === "string"
      ? [links]
      : [];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const match = candidate.match(/^\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/u);
    if (match?.[1] !== undefined) {
      return match[1].trim();
    }
  }

  return "";
}

function createTemplateContext(
  context: AnnotationNoteContext,
  annotation: ZoteroAnnotation,
  annotationNumber: number,
  managedBlock: string
): {
  book: ZoteroBook;
  pdf: ZoteroPdfAttachment;
  noteNames: {
    book: string;
    annotations: string;
  };
  annotation: ZoteroAnnotation;
  annotationNumber: number;
  annotationManagedBlock: string;
} {
  return {
    book: {
      key: context.itemKey,
      title: context.bookName,
      authors: [],
      year: "",
      totalPages: "",
      publisher: "",
      isbn: "",
      language: ""
    },
    pdf: {
      key: context.attachmentKey,
      title: "",
      filename: "",
      linkMode: ""
    },
    noteNames: {
      book: context.bookName,
      annotations: context.annotationsName
    },
    annotation,
    annotationNumber,
    annotationManagedBlock: managedBlock
  };
}

function createAvailableAtomicNotePath(
  app: App,
  text: string,
  annotationKey: string
): string {
  const baseName = createAnnotationNoteName(text, annotationKey);
  const preferredPath = normalizePath(`${baseName}.md`);
  if (app.vault.getAbstractFileByPath(preferredPath) === null) {
    return preferredPath;
  }

  return normalizePath(`${baseName} — ${annotationKey}.md`);
}

function replaceAtomicManagedBlock(
  content: string,
  replacement: string
): string {
  const startMarker = "<!-- zhs:atomic-annotation:start -->";
  const endMarker = "<!-- zhs:atomic-annotation:end -->";
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex < 0 || endIndex < startIndex) {
    throw new AtomicNoteError(
      "В отдельной заметке не найден служебный блок пометки."
    );
  }

  return [
    content.slice(0, startIndex),
    replacement,
    content.slice(endIndex + endMarker.length)
  ].join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}
