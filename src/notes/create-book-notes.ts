import {
  normalizePath,
  TAbstractFile,
  TFile,
  Vault
} from "obsidian";

import { translate } from "../i18n";
import type { ZoteroHighlightsSyncSettings } from "../settings";
import {
  readTemplate,
  renderTemplate,
  type TemplateNoteNames
} from "../templates";
import type {
  ZoteroBook,
  ZoteroPdfAttachment
} from "../zotero";
import { sanitizeNoteName } from "./names";

export interface CreateBookNotesResult {
  bookFile: TFile;
  annotationsFile: TFile;
  bookCreated: boolean;
  annotationsCreated: boolean;
}

export class NoteCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoteCreationError";
  }
}

export async function createBookNotes(
  vault: Vault,
  settings: ZoteroHighlightsSyncSettings,
  book: ZoteroBook,
  pdf: ZoteroPdfAttachment
): Promise<CreateBookNotesResult> {
  const noteNames = createNoteNames(book);
  const bookPath = normalizePath(`${noteNames.book}.md`);
  const annotationsPath = normalizePath(`${noteNames.annotations}.md`);

  const bookTemplate = await readTemplate(
    vault,
    settings.bookTemplatePath,
    translate("template.bookLabel")
  );
  const annotationsTemplate = await readTemplate(
    vault,
    settings.annotationsTemplatePath,
    translate("template.annotationsLabel")
  );

  const existingBook = await validateDestination(
    vault,
    bookPath,
    book.key,
    translate("note.bookDescription")
  );
  const existingAnnotations = await validateDestination(
    vault,
    annotationsPath,
    book.key,
    translate("note.annotationsDescription")
  );

  const context = {
    book,
    pdf,
    noteNames
  };
  const renderedBook = renderTemplate(bookTemplate, context);
  const renderedAnnotations = renderTemplate(annotationsTemplate, context);

  const bookFile = existingBook
    ?? await vault.create(bookPath, ensureTrailingNewline(renderedBook));
  const annotationsFile = existingAnnotations
    ?? await vault.create(
      annotationsPath,
      ensureTrailingNewline(renderedAnnotations)
    );

  return {
    bookFile,
    annotationsFile,
    bookCreated: existingBook === null,
    annotationsCreated: existingAnnotations === null
  };
}

function createNoteNames(book: ZoteroBook): TemplateNoteNames {
  const bookName = sanitizeNoteName(
    book.title,
    translate("note.untitled", { key: book.key })
  );

  return {
    book: bookName,
    annotations: sanitizeNoteName(
      `Annotations for ${bookName}`,
      `Annotations for ${book.key}`
    )
  };
}

async function validateDestination(
  vault: Vault,
  path: string,
  itemKey: string,
  description: string
): Promise<TFile | null> {
  const destination = vault.getAbstractFileByPath(path);
  if (destination === null) {
    return null;
  }

  assertMarkdownFile(destination, path);
  const existingItemKey = extractZoteroItemKey(
    await vault.cachedRead(destination)
  );

  if (existingItemKey !== itemKey) {
    throw new NoteCreationError(
      translate("note.pathOccupiedByOtherBook", {
        path,
        description
      })
    );
  }

  return destination;
}

function assertMarkdownFile(
  file: TAbstractFile,
  path: string
): asserts file is TFile {
  if (!(file instanceof TFile) || file.extension !== "md") {
    throw new NoteCreationError(
      translate("note.pathOccupied", { path })
    );
  }
}

function extractZoteroItemKey(content: string): string {
  const frontmatter = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/u)?.[1];
  if (frontmatter === undefined) {
    return "";
  }

  const itemKeyLine = frontmatter.match(
    /^zotero_item_key:\s*["']?([A-Za-z0-9]+)["']?\s*$/mu
  );
  return itemKeyLine?.[1] ?? "";
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}
