export type PluginLanguage = "ru" | "en";

type TranslationParameters = Record<string, string | number>;

const RU_MESSAGES = {
  "settings.language.name": "Язык",
  "settings.language.description":
    "Язык команд, настроек, кнопок, уведомлений и создаваемых подписей.",
  "settings.language.ru": "Русский",
  "settings.language.en": "English",
  "settings.plugin.description":
    "Создаёт связанные заметки книг и синхронизирует PDF-пометки из Zotero.",
  "settings.templates.intro":
    "Выберите три Markdown-шаблона. Можно вводить путь вручную или выбрать файл из подсказок.",
  "settings.template.book.name": "Шаблон заметки книги",
  "settings.template.book.description":
    "Шаблон для файла «Название книги».",
  "settings.template.annotations.name":
    "Шаблон общей заметки аннотаций",
  "settings.template.annotations.description":
    "Шаблон для файла «Annotations for Название книги».",
  "settings.template.annotation.name":
    "Шаблон отдельной аннотации",
  "settings.template.annotation.description":
    "Шаблон заметки, создаваемой из одной пометки.",
  "settings.template.placeholder": "Templates/Название шаблона.md",
  "settings.template.select": "Выберите Markdown-шаблон.",
  "settings.template.notFound": "Markdown-файл не найден.",
  "settings.template.status.empty": "Не задан",
  "settings.template.status.valid": "Файл найден",

  "command.createBook": "Создание книги",
  "command.checkConnection": "Проверить соединение с Zotero",
  "command.inspectAnnotations": "Проверить пометки текущей книги",
  "command.createAllAtomic":
    "Создать отдельные заметки для всех пометок",

  "button.updateAnnotations": "Обновить пометки",
  "button.createNote": "Создать заметку",
  "button.openNote": "Открыть заметку",
  "button.updateNote": "Обновить заметку",
  "button.updating": "Обновление…",
  "button.creating": "Создание…",

  "toolbar.missingAttachmentKey":
    "В служебном блоке отсутствует ключ PDF Zotero",
  "toolbar.invalidAnnotationData": "Некорректные данные кнопок пометки",

  "notice.noBooks": "В личной библиотеке Zotero не найдено книг",
  "notice.noPdf": "У книги «{{title}}» нет PDF-вложения в Zotero",
  "notice.notesAlreadyExist":
    "Заметки этой книги уже существуют — открыта заметка книги",
  "notice.createdBookNote": "заметка книги",
  "notice.createdAnnotationsNote": "заметка с пометками",
  "notice.created": "Создано: {{items}}",
  "notice.createFailed": "Не удалось создать заметки: {{message}}",
  "notice.connectionOk":
    "Соединение с Zotero установлено. Книг: {{count}}",
  "notice.openBookOrAnnotations":
    "Откройте заметку книги или заметку с пометками, содержащую ключ PDF Zotero",
  "notice.annotationStats":
    "Zotero вернул пометок: {{count}}. С текстом: {{withText}}. С комментариями: {{withComments}}.",
  "notice.annotationsNoteNotFound":
    "Не удалось найти общую заметку с пометками",
  "notice.atomicSync":
    " Отдельных заметок обновлено: {{updated}}; источник удалён: {{deleted}}.",
  "notice.atomicSyncFailed": " Не удалось обновить: {{items}}.",
  "notice.syncComplete":
    "Пометки обновлены: {{count}}. Новых: {{added}}, изменённых: {{changed}}, удалённых: {{removed}}.",
  "notice.pdfStructureWarning":
    "Не удалось восстановить структуру текста PDF.",
  "notice.annotationNumberMissing":
    "Не найден порядковый номер пометки.",
  "notice.openBookOrAnnotationsShort":
    "Откройте заметку книги или общую заметку с пометками",
  "notice.annotationsMissingAttachment":
    "В общей заметке отсутствует ключ PDF Zotero",
  "notice.createAtomicSummary":
    "Создано отдельных заметок: {{created}}. Уже существовало: {{skipped}}.{{failure}}{{warning}}",
  "notice.createAtomicFailed": " Не удалось создать: {{items}}.",
  "notice.atomicCreated": "Создана заметка: {{name}}",
  "notice.atomicUpdated": "Заметка обновлена: {{name}}",
  "notice.atomicProcessFailed":
    "Не удалось обработать отдельную заметку: {{message}}",
  "notice.enableZoteroApi":
    "В Zotero включите: Настройки → Расширенные → Разрешить другим приложениям на этом компьютере связываться с Zotero",
  "notice.unknownConnectionError":
    "Неизвестная ошибка подключения к Zotero",

  "modal.book.placeholder": "Введите название книги или автора",
  "modal.pdf.placeholder": "Выберите вложение PDF",
  "modal.instruction.select": "выбрать",
  "modal.instruction.confirm": "подтвердить",
  "modal.instruction.close": "закрыть",
  "modal.book.noDetails": "Автор и год не указаны",
  "modal.pdf.key": "Ключ Zotero: {{key}}",

  "zotero.apiDisabled": "Локальный API Zotero выключен.",
  "zotero.http": "Zotero вернул HTTP {{status}}.",
  "zotero.invalidBooks":
    "Zotero вернул данные в неожиданном формате.",
  "zotero.httpAttachments":
    "Zotero вернул HTTP {{status}} при загрузке вложений.",
  "zotero.invalidAttachments":
    "Zotero вернул список вложений в неожиданном формате.",
  "zotero.httpAnnotations":
    "Zotero вернул HTTP {{status}} при загрузке пометок.",
  "zotero.invalidAnnotations":
    "Zotero вернул список пометок в неожиданном формате.",
  "zotero.noPdfPath": "Zotero не вернул путь к выбранному PDF.",
  "zotero.unsafePdfPath": "Zotero вернул небезопасный путь к PDF.",
  "zotero.httpPageCount":
    "Zotero вернул HTTP {{status}} при чтении числа страниц.",
  "zotero.timeout": "Превышено время ожидания ответа Zotero.",
  "zotero.invalidJson": "Zotero вернул некорректный JSON.",
  "zotero.untitled": "Без названия",
  "zotero.connectionFailed":
    "Не удалось подключиться к локальному API Zotero: {{details}}",
  "zotero.connectionFailedShort":
    "Не удалось подключиться к локальному API Zotero.",

  "pdf.readFailed":
    "Не удалось прочитать локальный PDF для восстановления абзацев.",
  "pdf.analyzeFailed":
    "Не удалось проанализировать PDF для восстановления абзацев.",

  "template.bookLabel": "Шаблон заметки книги",
  "template.annotationsLabel": "Шаблон общей заметки аннотаций",
  "template.annotationLabel": "Шаблон отдельной пометки",
  "template.notFound": "{{label}} не найден: {{path}}",
  "template.pathMissing": "путь не указан",
  "template.unknownVariables":
    "Неизвестные переменные шаблона: {{variables}}",

  "note.bookDescription": "заметки книги",
  "note.annotationsDescription": "заметки с пометками",
  "note.untitled": "Без названия {{key}}",
  "note.pathOccupiedByOtherBook":
    "Файл {{path}} уже существует, но не относится к выбранной книге. Переименуйте существующий файл или книгу перед созданием {{description}}.",
  "note.pathOccupied": "Путь {{path}} уже занят и не является Markdown-заметкой.",
  "note.annotationSuffix": "{{filename}} — заметка",
  "note.annotationFallback": "Пометка {{key}}",
  "note.annotationShortTitleFallback": "Пометка {{key}}",
  "note.atomicMissingBookData":
    "В общей заметке отсутствуют ключ книги или ключ PDF Zotero.",
  "note.atomicMissingBookLink":
    "В свойстве links общей заметки отсутствует ссылка на заметку книги.",
  "note.atomicMissingManagedBlock":
    "В отдельной заметке не найден служебный блок пометки.",
  "note.annotationNoLongerExists":
    "Пометка больше не существует в Zotero.",

  "sync.missingManagedBlock":
    "В заметке не найден служебный блок пометок. Верните переменную {{zhs.annotations.managed_block}} в шаблон и заново создайте заметку.",
  "sync.page": "стр. {{page}}",
  "sync.noText": "Текст выделения отсутствует",
  "sync.zoteroComment": "Комментарий Zotero",
  "sync.openInZotero": "Открыть пометку в Zotero",

  "common.unknownError": "Неизвестная ошибка",
  "common.unknownErrorLower": "неизвестная ошибка"
} as const;

export type TranslationKey = keyof typeof RU_MESSAGES;

const EN_MESSAGES: Record<TranslationKey, string> = {
  "settings.language.name": "Language",
  "settings.language.description":
    "Language for commands, settings, buttons, notices, and generated labels.",
  "settings.language.ru": "Русский",
  "settings.language.en": "English",
  "settings.plugin.description":
    "Creates linked book notes and synchronizes Zotero PDF annotations.",
  "settings.templates.intro":
    "Select three Markdown templates. Enter a path manually or choose a file from suggestions.",
  "settings.template.book.name": "Book note template",
  "settings.template.book.description":
    "Template for the “Book title” file.",
  "settings.template.annotations.name": "Annotations note template",
  "settings.template.annotations.description":
    "Template for the “Annotations for Book title” file.",
  "settings.template.annotation.name": "Atomic annotation template",
  "settings.template.annotation.description":
    "Template for a note created from one annotation.",
  "settings.template.placeholder": "Templates/Template name.md",
  "settings.template.select": "Select a Markdown template.",
  "settings.template.notFound": "Markdown file not found.",
  "settings.template.status.empty": "Not set",
  "settings.template.status.valid": "File found",

  "command.createBook": "Create book",
  "command.checkConnection": "Check Zotero connection",
  "command.inspectAnnotations": "Inspect current book annotations",
  "command.createAllAtomic": "Create notes for all annotations",

  "button.updateAnnotations": "Update annotations",
  "button.createNote": "Create note",
  "button.openNote": "Open note",
  "button.updateNote": "Update note",
  "button.updating": "Updating…",
  "button.creating": "Creating…",

  "toolbar.missingAttachmentKey":
    "The service block is missing the Zotero PDF key",
  "toolbar.invalidAnnotationData": "Invalid annotation button data",

  "notice.noBooks": "No books found in the personal Zotero library",
  "notice.noPdf": "“{{title}}” has no PDF attachment in Zotero",
  "notice.notesAlreadyExist":
    "Notes for this book already exist — the book note was opened",
  "notice.createdBookNote": "book note",
  "notice.createdAnnotationsNote": "annotations note",
  "notice.created": "Created: {{items}}",
  "notice.createFailed": "Could not create notes: {{message}}",
  "notice.connectionOk":
    "Connected to Zotero. Books found: {{count}}",
  "notice.openBookOrAnnotations":
    "Open a book note or annotations note that contains a Zotero PDF key",
  "notice.annotationStats":
    "Zotero returned {{count}} annotations. With text: {{withText}}. With comments: {{withComments}}.",
  "notice.annotationsNoteNotFound":
    "Could not find the annotations note",
  "notice.atomicSync":
    " Atomic notes updated: {{updated}}; source deleted: {{deleted}}.",
  "notice.atomicSyncFailed": " Failed to update: {{items}}.",
  "notice.syncComplete":
    "Annotations updated: {{count}}. Added: {{added}}, changed: {{changed}}, removed: {{removed}}.",
  "notice.pdfStructureWarning":
    "Could not restore the PDF text structure.",
  "notice.annotationNumberMissing":
    "Could not find the annotation number.",
  "notice.openBookOrAnnotationsShort":
    "Open a book note or annotations note",
  "notice.annotationsMissingAttachment":
    "The annotations note is missing the Zotero PDF key",
  "notice.createAtomicSummary":
    "Atomic notes created: {{created}}. Already existed: {{skipped}}.{{failure}}{{warning}}",
  "notice.createAtomicFailed": " Failed to create: {{items}}.",
  "notice.atomicCreated": "Note created: {{name}}",
  "notice.atomicUpdated": "Note updated: {{name}}",
  "notice.atomicProcessFailed":
    "Could not process the atomic note: {{message}}",
  "notice.enableZoteroApi":
    "In Zotero, enable Settings → Advanced → Allow other applications on this computer to communicate with Zotero",
  "notice.unknownConnectionError": "Unknown Zotero connection error",

  "modal.book.placeholder": "Enter a book title or author",
  "modal.pdf.placeholder": "Select a PDF attachment",
  "modal.instruction.select": "select",
  "modal.instruction.confirm": "confirm",
  "modal.instruction.close": "close",
  "modal.book.noDetails": "Author and year are not specified",
  "modal.pdf.key": "Zotero key: {{key}}",

  "zotero.apiDisabled": "The Zotero local API is disabled.",
  "zotero.http": "Zotero returned HTTP {{status}}.",
  "zotero.invalidBooks": "Zotero returned data in an unexpected format.",
  "zotero.httpAttachments":
    "Zotero returned HTTP {{status}} while loading attachments.",
  "zotero.invalidAttachments":
    "Zotero returned the attachment list in an unexpected format.",
  "zotero.httpAnnotations":
    "Zotero returned HTTP {{status}} while loading annotations.",
  "zotero.invalidAnnotations":
    "Zotero returned the annotation list in an unexpected format.",
  "zotero.noPdfPath": "Zotero did not return a path to the selected PDF.",
  "zotero.unsafePdfPath": "Zotero returned an unsafe PDF path.",
  "zotero.httpPageCount":
    "Zotero returned HTTP {{status}} while reading the page count.",
  "zotero.timeout": "The Zotero request timed out.",
  "zotero.invalidJson": "Zotero returned invalid JSON.",
  "zotero.untitled": "Untitled",
  "zotero.connectionFailed":
    "Could not connect to the Zotero local API: {{details}}",
  "zotero.connectionFailedShort":
    "Could not connect to the Zotero local API.",

  "pdf.readFailed":
    "Could not read the local PDF to restore paragraph boundaries.",
  "pdf.analyzeFailed":
    "Could not analyze the PDF to restore paragraph boundaries.",

  "template.bookLabel": "Book note template",
  "template.annotationsLabel": "Annotations note template",
  "template.annotationLabel": "Atomic annotation template",
  "template.notFound": "{{label}} not found: {{path}}",
  "template.pathMissing": "path not specified",
  "template.unknownVariables":
    "Unknown template variables: {{variables}}",

  "note.bookDescription": "the book note",
  "note.annotationsDescription": "the annotations note",
  "note.untitled": "Untitled {{key}}",
  "note.pathOccupiedByOtherBook":
    "{{path}} already exists but does not belong to the selected book. Rename the existing file or the book before creating {{description}}.",
  "note.pathOccupied":
    "{{path}} is already occupied and is not a Markdown note.",
  "note.annotationSuffix": "{{filename}} — note",
  "note.annotationFallback": "Annotation {{key}}",
  "note.annotationShortTitleFallback": "Annotation {{key}}",
  "note.atomicMissingBookData":
    "The annotations note is missing the Zotero book or PDF key.",
  "note.atomicMissingBookLink":
    "The annotations note links property has no link to the book note.",
  "note.atomicMissingManagedBlock":
    "The atomic note does not contain the managed annotation block.",
  "note.annotationNoLongerExists":
    "The annotation no longer exists in Zotero.",

  "sync.missingManagedBlock":
    "The annotations note does not contain the managed annotations block. Restore {{zhs.annotations.managed_block}} in the template and recreate the note.",
  "sync.page": "p. {{page}}",
  "sync.noText": "No highlighted text",
  "sync.zoteroComment": "Zotero comment",
  "sync.openInZotero": "Open annotation in Zotero",

  "common.unknownError": "Unknown error",
  "common.unknownErrorLower": "unknown error"
};

const MESSAGES: Record<
  PluginLanguage,
  Record<TranslationKey, string>
> = {
  ru: RU_MESSAGES,
  en: EN_MESSAGES
};

let currentLanguage: PluginLanguage = "ru";

export function isPluginLanguage(value: unknown): value is PluginLanguage {
  return value === "ru" || value === "en";
}

export function setPluginLanguage(language: PluginLanguage): void {
  currentLanguage = language;
}

export function getPluginLanguage(): PluginLanguage {
  return currentLanguage;
}

export function translate(
  key: TranslationKey,
  parameters: TranslationParameters = {}
): string {
  let result: string = MESSAGES[currentLanguage][key];

  for (const [name, value] of Object.entries(parameters)) {
    result = result.replaceAll(`{{${name}}}`, String(value));
  }

  return result;
}

export function setLocalizedText(
  element: HTMLElement,
  key: TranslationKey
): void {
  element.dataset.zhsI18nKey = key;
  element.setText(translate(key));
}

export function refreshLocalizedElements(): void {
  const elements = document.querySelectorAll<HTMLElement>(
    "[data-zhs-i18n-key]"
  );

  elements.forEach((element) => {
    const key = element.dataset.zhsI18nKey;
    if (key !== undefined && key in RU_MESSAGES) {
      element.setText(translate(key as TranslationKey));
    }
  });
}
