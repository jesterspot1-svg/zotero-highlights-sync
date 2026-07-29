import {
  normalizePath,
  TFile,
  Vault
} from "obsidian";

import type {
  ZoteroAnnotation,
  ZoteroBook,
  ZoteroPdfAttachment
} from "../zotero";

export interface TemplateNoteNames {
  book: string;
  annotations: string;
}

export interface TemplateRenderContext {
  book: ZoteroBook;
  pdf: ZoteroPdfAttachment;
  noteNames: TemplateNoteNames;
  annotationsCount?: number;
  lastSync?: string;
  annotation?: ZoteroAnnotation;
  annotationNumber?: number;
  annotationManagedBlock?: string;
}

export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateError";
  }
}

const ZHS_VARIABLE_PATTERN = /\{\{\s*(zhs\.[a-z0-9_.]+)\s*\}\}/giu;

export async function readTemplate(
  vault: Vault,
  templatePath: string,
  label: string
): Promise<string> {
  const normalizedPath = normalizePath(templatePath.trim());
  const template = vault.getAbstractFileByPath(normalizedPath);

  if (!(template instanceof TFile) || template.extension !== "md") {
    throw new TemplateError(
      `${label} не найден: ${normalizedPath || "путь не указан"}`
    );
  }

  return vault.cachedRead(template);
}

export function renderTemplate(
  template: string,
  context: TemplateRenderContext
): string {
  const variables = buildVariables(context);
  const unknownVariables = new Set<string>();

  const rendered = template.replace(
    ZHS_VARIABLE_PATTERN,
    (_match: string, variableName: string) => {
      const value = variables.get(variableName);
      if (value === undefined) {
        unknownVariables.add(variableName);
        return `{{${variableName}}}`;
      }

      return value;
    }
  );

  if (unknownVariables.size > 0) {
    throw new TemplateError(
      `Неизвестные переменные шаблона: ${[...unknownVariables].join(", ")}`
    );
  }

  return rendered;
}

function buildVariables(
  context: TemplateRenderContext
): ReadonlyMap<string, string> {
  const { book, pdf, noteNames } = context;
  const zoteroPdfLink = `zotero://open-pdf/library/items/${pdf.key}`;

  const variables = new Map<string, string>([
    ["zhs.book.title", book.title],
    ["zhs.book.title_yaml", toYamlString(book.title)],
    ["zhs.book.authors_yaml", toYamlStringArray(book.authors)],
    ["zhs.book.year", book.year],
    ["zhs.book.total_pages", book.totalPages],
    ["zhs.book.item_key", book.key],
    ["zhs.book.item_key_yaml", toYamlString(book.key)],
    ["zhs.book.zotero_link", zoteroPdfLink],
    ["zhs.book.zotero_link_yaml", toYamlString(zoteroPdfLink)],
    ["zhs.pdf.attachment_key", pdf.key],
    ["zhs.pdf.attachment_key_yaml", toYamlString(pdf.key)],
    ["zhs.note.book_link", toWikiLink(noteNames.book)],
    ["zhs.note.book_link_yaml", toYamlString(toWikiLink(noteNames.book))],
    ["zhs.note.annotations_link", toWikiLink(noteNames.annotations)],
    [
      "zhs.note.annotations_link_yaml",
      toYamlString(toWikiLink(noteNames.annotations))
    ],
    ["zhs.annotations.count", String(context.annotationsCount ?? 0)],
    ["zhs.sync.last_sync", context.lastSync ?? ""],
    ["zhs.sync.last_sync_yaml", toYamlString(context.lastSync ?? "")],
    ["zhs.annotations.toolbar", createToolbarBlock(book.key, pdf.key)],
    ["zhs.annotations.managed_block", createManagedAnnotationsBlock()]
  ]);

  if (context.annotation !== undefined) {
    const annotation = context.annotation;
    const annotationNumber = context.annotationNumber ?? 0;
    const annotationLink = [
      `zotero://open-pdf/library/items/${pdf.key}`,
      `?annotation=${annotation.key}`
    ].join("");

    variables.set("zhs.annotation.number", String(annotationNumber));
    variables.set("zhs.annotation.key", annotation.key);
    variables.set(
      "zhs.annotation.key_yaml",
      toYamlString(annotation.key)
    );
    variables.set("zhs.annotation.page", annotation.pageLabel);
    variables.set(
      "zhs.annotation.page_yaml",
      toYamlString(annotation.pageLabel)
    );
    variables.set("zhs.annotation.color", annotation.color);
    variables.set(
      "zhs.annotation.color_yaml",
      toYamlString(annotation.color)
    );
    variables.set("zhs.annotation.date_added", annotation.dateAdded);
    variables.set(
      "zhs.annotation.date_added_yaml",
      toYamlString(annotation.dateAdded)
    );
    variables.set("zhs.annotation.date_modified", annotation.dateModified);
    variables.set(
      "zhs.annotation.date_modified_yaml",
      toYamlString(annotation.dateModified)
    );
    variables.set("zhs.annotation.zotero_link", annotationLink);
    variables.set(
      "zhs.annotation.zotero_link_yaml",
      toYamlString(annotationLink)
    );
    variables.set(
      "zhs.annotation.short_title",
      createAnnotationShortTitle(annotation.text, annotation.key)
    );
    variables.set(
      "zhs.annotation.managed_block",
      context.annotationManagedBlock ?? ""
    );
  }

  return variables;
}

function toWikiLink(noteName: string): string {
  return `[[${noteName}]]`;
}

function toYamlString(value: string): string {
  return JSON.stringify(value);
}

function toYamlStringArray(values: string[]): string {
  return JSON.stringify(values);
}

function createToolbarBlock(itemKey: string, attachmentKey: string): string {
  return [
    "```zhs-annotations-toolbar",
    `item_key: ${itemKey}`,
    `attachment_key: ${attachmentKey}`,
    "```"
  ].join("\n");
}

function createManagedAnnotationsBlock(): string {
  return [
    "<!-- zhs:annotations:start -->",
    "<!-- zhs:annotations:end -->"
  ].join("\n");
}

function createAnnotationShortTitle(text: string, fallbackKey: string): string {
  const words = text.trim().split(/\s+/gu).filter((word) => word.length > 0);
  return words.slice(0, 7).join(" ") || `Пометка ${fallbackKey}`;
}
