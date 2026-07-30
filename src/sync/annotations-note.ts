import { translate } from "../i18n";
import type { ZoteroAnnotation } from "../zotero";

export interface AnnotationSyncResult {
  content: string;
  count: number;
  added: number;
  changed: number;
  removed: number;
}

export class AnnotationSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnnotationSyncError";
  }
}

interface ExistingAnnotation {
  number: number;
  modified: string;
}

const START_MARKER = "<!-- zhs:annotations:start -->";
const END_MARKER = "<!-- zhs:annotations:end -->";
const ANNOTATION_MARKER_PATTERN =
  /<!-- zhs:annotation key=([A-Za-z0-9]+) number=(\d+)(?: modified=([^\s]+))? -->/gu;

export function synchronizeAnnotationsContent(
  content: string,
  annotations: ZoteroAnnotation[],
  attachmentKey: string
): AnnotationSyncResult {
  const startIndex = content.indexOf(START_MARKER);
  const endIndex = content.indexOf(END_MARKER);

  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
    throw new AnnotationSyncError(
      translate("sync.missingManagedBlock")
    );
  }

  const managedContent = content.slice(
    startIndex + START_MARKER.length,
    endIndex
  );
  const existing = readExistingAnnotations(managedContent);
  const importableAnnotations = annotations.filter(
    (annotation) => annotation.text.length > 0
      || annotation.comment.length > 0
  );
  const numberedAnnotations = assignNumbers(
    importableAnnotations,
    existing
  );
  const currentKeys = new Set(
    numberedAnnotations.map(({ annotation }) => annotation.key)
  );
  const renderedAnnotations = numberedAnnotations
    .map(({ annotation, number }) => {
      return renderAnnotation(annotation, number, attachmentKey);
    })
    .join("\n\n");
  const replacement = renderedAnnotations.length > 0
    ? `${START_MARKER}\n\n${renderedAnnotations}\n\n${END_MARKER}`
    : `${START_MARKER}\n${END_MARKER}`;
  const contentAfterEnd = content.slice(endIndex + END_MARKER.length);

  return {
    content: [
      content.slice(0, startIndex),
      replacement,
      contentAfterEnd
    ].join(""),
    count: numberedAnnotations.length,
    added: numberedAnnotations.filter(({ annotation }) => {
      return !existing.has(annotation.key);
    }).length,
    changed: numberedAnnotations.filter(({ annotation }) => {
      const previous = existing.get(annotation.key);
      return previous !== undefined
        && previous.modified !== annotation.dateModified;
    }).length,
    removed: [...existing.keys()].filter((key) => !currentKeys.has(key)).length
  };
}

export function readAnnotationNumbers(content: string): Map<string, number> {
  const startIndex = content.indexOf(START_MARKER);
  const endIndex = content.indexOf(END_MARKER);
  if (startIndex < 0 || endIndex < startIndex) {
    return new Map<string, number>();
  }

  const existing = readExistingAnnotations(
    content.slice(startIndex + START_MARKER.length, endIndex)
  );
  return new Map(
    [...existing.entries()].map(([key, value]) => [key, value.number])
  );
}

function readExistingAnnotations(
  managedContent: string
): Map<string, ExistingAnnotation> {
  const existing = new Map<string, ExistingAnnotation>();

  for (const match of managedContent.matchAll(ANNOTATION_MARKER_PATTERN)) {
    const key = match[1];
    const numberText = match[2];
    if (key === undefined || numberText === undefined) {
      continue;
    }

    const number = Number.parseInt(numberText, 10);
    if (!Number.isSafeInteger(number) || number < 1) {
      continue;
    }

    existing.set(key, {
      number,
      modified: decodeMarkerValue(match[3] ?? "")
    });
  }

  return existing;
}

function assignNumbers(
  annotations: ZoteroAnnotation[],
  existing: ReadonlyMap<string, ExistingAnnotation>
): Array<{ annotation: ZoteroAnnotation; number: number }> {
  let nextNumber = Math.max(
    0,
    ...[...existing.values()].map(({ number }) => number)
  ) + 1;

  return annotations.map((annotation) => {
    const previous = existing.get(annotation.key);
    if (previous !== undefined) {
      return {
        annotation,
        number: previous.number
      };
    }

    const number = nextNumber;
    nextNumber += 1;
    return {
      annotation,
      number
    };
  });
}

function renderAnnotation(
  annotation: ZoteroAnnotation,
  number: number,
  attachmentKey: string
): string {
  const marker = [
    "<!-- zhs:annotation",
    `key=${annotation.key}`,
    `number=${number}`,
    `modified=${encodeURIComponent(annotation.dateModified)}`,
    "-->"
  ].join(" ");
  const calloutType = getCalloutType(annotation.color);
  const page = annotation.pageLabel.length > 0
    ? ` · ${translate("sync.page", { page: annotation.pageLabel })}`
    : "";
  const lines = [
    marker,
    renderAnnotationCalloutStart(calloutType, number, page)
  ];

  if (annotation.text.length > 0) {
    lines.push(...quoteText(annotation.text));
  } else {
    lines.push(`> _${translate("sync.noText")}_`);
  }

  if (annotation.comment.length > 0) {
    lines.push(
      ">",
      `> **${translate("sync.zoteroComment")}**`,
      ">",
      ...quoteText(annotation.comment)
    );
  }

  const zoteroLink = [
    `zotero://open-pdf/library/items/${attachmentKey}`,
    `?annotation=${annotation.key}`
  ].join("");
  lines.push(
    ">",
    `> [${translate("sync.openInZotero")}](${zoteroLink})`,
    "",
    "```zhs-annotation-actions",
    `annotation_key: ${annotation.key}`,
    `attachment_key: ${attachmentKey}`,
    `annotation_number: ${number}`,
    "```"
  );

  return lines.join("\n");
}

export function renderAtomicAnnotationManagedBlock(
  annotation: ZoteroAnnotation,
  number: number,
  attachmentKey: string
): string {
  const calloutType = getCalloutType(annotation.color);
  const page = annotation.pageLabel.length > 0
    ? ` · ${translate("sync.page", { page: annotation.pageLabel })}`
    : "";
  const lines = [
    "<!-- zhs:atomic-annotation:start -->",
    renderAnnotationCalloutStart(calloutType, number, page)
  ];

  if (annotation.text.length > 0) {
    lines.push(...quoteText(annotation.text));
  } else {
    lines.push(`> _${translate("sync.noText")}_`);
  }

  if (annotation.comment.length > 0) {
    lines.push(
      ">",
      `> **${translate("sync.zoteroComment")}**`,
      ">",
      ...quoteText(annotation.comment)
    );
  }

  const zoteroLink = [
    `zotero://open-pdf/library/items/${attachmentKey}`,
    `?annotation=${annotation.key}`
  ].join("");
  lines.push(
    ">",
    `> [${translate("sync.openInZotero")}](${zoteroLink})`,
    "<!-- zhs:atomic-annotation:end -->"
  );

  return lines.join("\n");
}

function renderAnnotationCalloutStart(
  calloutType: string,
  number: number,
  page: string
): string {
  return `> [!${calloutType}] № ${number}${page}`;
}

function quoteText(text: string): string[] {
  return text
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.length > 0 ? `> ${line}` : ">");
}

function getCalloutType(color: string): string {
  const colorToCallout: Record<string, string> = {
    "#ffd400": "zhs-annotation-yellow",
    "#ff6666": "zhs-annotation-red",
    "#5fb236": "zhs-annotation-green",
    "#2ea8e5": "zhs-annotation-blue",
    "#a28ae5": "zhs-annotation-purple",
    "#e56eee": "zhs-annotation-magenta",
    "#f19837": "zhs-annotation-orange",
    "#aaaaaa": "zhs-annotation-gray"
  };

  return colorToCallout[color.toLowerCase()] ?? "zhs-annotation-gray";
}

function decodeMarkerValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
