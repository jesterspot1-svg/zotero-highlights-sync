import { readFile } from "fs/promises";

import {
  getDocument
} from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  WorkerMessageHandler
} from "pdfjs-dist/legacy/build/pdf.worker.mjs";

import type { ZoteroAnnotation } from "../zotero";

type PdfRect = [number, number, number, number];

interface AnnotationPosition {
  pageIndex: number;
  rects: PdfRect[];
}

interface SelectedLine {
  text: string;
  hasBullet: boolean;
  left: number;
  centerY: number;
  height: number;
}

interface PdfTextItem {
  str: string;
  width: number;
  height: number;
  transform: number[];
}

interface PdfJsGlobal {
  pdfjsWorker?: {
    WorkerMessageHandler: unknown;
  };
}

type ReadPdfFile = (path: string) => Promise<Uint8Array>;

const readPdfFile = readFile as unknown as ReadPdfFile;

export class PdfStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfStructureError";
  }
}

export async function restoreAnnotationsTextStructure(
  pdfPath: string,
  annotations: ZoteroAnnotation[]
): Promise<ZoteroAnnotation[]> {
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = new Uint8Array(await readPdfFile(pdfPath));
  } catch {
    throw new PdfStructureError(
      "Не удалось прочитать локальный PDF для восстановления абзацев."
    );
  }

  const pdfGlobal = window as unknown as PdfJsGlobal;
  pdfGlobal.pdfjsWorker ??= {
    WorkerMessageHandler
  };
  const loadingTask = getDocument({
    data: pdfBytes
  });

  try {
    const pdf = await loadingTask.promise;
    const textItemsByPage = new Map<number, PdfTextItem[]>();
    const restoredAnnotations: ZoteroAnnotation[] = [];

    for (const annotation of annotations) {
      const position = parseAnnotationPosition(annotation.position);
      if (position === null || annotation.text.length === 0) {
        restoredAnnotations.push(annotation);
        continue;
      }

      const cachedTextItems = textItemsByPage.get(position.pageIndex);
      let textItems: PdfTextItem[];
      if (cachedTextItems === undefined) {
        const page = await pdf.getPage(position.pageIndex + 1);
        const textContent = await page.getTextContent();
        textItems = textContent.items.flatMap((item) => {
          const candidate: unknown = item;
          return isPdfTextItem(candidate) ? [candidate] : [];
        });
        textItemsByPage.set(position.pageIndex, textItems);
      } else {
        textItems = cachedTextItems;
      }

      const selectedLines = position.rects.map((rect) => {
        return readSelectedLine(textItems, rect);
      });
      const restoredText = insertParagraphBreaks(
        annotation.text,
        selectedLines
      );

      restoredAnnotations.push({
        ...annotation,
        text: restoredText
      });
    }

    return restoredAnnotations;
  } catch (error: unknown) {
    if (error instanceof PdfStructureError) {
      throw error;
    }

    throw new PdfStructureError(
      "Не удалось проанализировать PDF для восстановления абзацев."
    );
  } finally {
    try {
      await loadingTask.destroy();
    } catch {
      // A worker shutdown error must not discard successfully restored text.
    }
  }
}

function parseAnnotationPosition(value: string): AnnotationPosition | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    const { pageIndex, rects } = parsed;
    if (
      typeof pageIndex !== "number"
      || !Number.isSafeInteger(pageIndex)
      || pageIndex < 0
      || !Array.isArray(rects)
    ) {
      return null;
    }

    const validRects = rects.filter(isPdfRect);
    return validRects.length > 0
      ? {
        pageIndex,
        rects: validRects
      }
      : null;
  } catch {
    return null;
  }
}

function isPdfRect(value: unknown): value is PdfRect {
  return Array.isArray(value)
    && value.length === 4
    && value.every((coordinate) => typeof coordinate === "number");
}

function isPdfTextItem(value: unknown): value is PdfTextItem {
  return isRecord(value)
    && typeof value.str === "string"
    && typeof value.width === "number"
    && typeof value.height === "number"
    && Array.isArray(value.transform)
    && value.transform.length >= 6;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readSelectedLine(
  items: PdfTextItem[],
  rect: PdfRect
): SelectedLine {
  const centerY = (rect[1] + rect[3]) / 2;
  const height = Math.abs(rect[3] - rect[1]);
  const verticalTolerance = Math.max(4, height * 0.55);
  const itemsOnLine = items
    .filter((item) => {
      const itemY = item.transform[5];
      return typeof itemY === "number"
        && Math.abs(itemY - centerY) <= verticalTolerance;
    })
    .sort((left, right) => {
      return readTransformCoordinate(left, 4)
        - readTransformCoordinate(right, 4);
    });
  const hasBullet = itemsOnLine.some((item) => {
    const itemLeft = readTransformCoordinate(item, 4);
    const itemRight = itemLeft + item.width;
    const distanceFromSelection = rect[0] - itemRight;

    return isBulletGlyph(item.str)
      && distanceFromSelection >= -2
      && distanceFromSelection <= 30;
  });
  const text = itemsOnLine
    .filter((item) => {
      const itemLeft = readTransformCoordinate(item, 4);
      const itemRight = itemLeft + item.width;
      const overlapsSelection = itemRight >= rect[0] - 2
        && itemLeft <= rect[2] + 2;

      return overlapsSelection
        && !isBulletGlyph(item.str)
        && item.str.trim().length > 0;
    })
    .map((item) => item.str.trim())
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();

  return {
    text,
    hasBullet,
    left: rect[0],
    centerY,
    height
  };
}

function readTransformCoordinate(item: PdfTextItem, index: number): number {
  const coordinate = item.transform[index];
  return typeof coordinate === "number" ? coordinate : 0;
}

function isBulletGlyph(value: string): boolean {
  const token = value.trim();
  if (token.length === 0) {
    return false;
  }

  const firstCodePoint = token.codePointAt(0);
  return firstCodePoint === 129
    || /^[•◦▪‣⁃▸►●○■□]$/u.test(token);
}

function insertParagraphBreaks(
  annotationText: string,
  lines: SelectedLine[]
): string {
  if (lines.length < 2) {
    return annotationText;
  }

  const typicalLineGap = median(
    lines.slice(1).map((line, index) => {
      const previousLine = lines[index];
      return previousLine === undefined
        ? 0
        : Math.abs(previousLine.centerY - line.centerY);
    }).filter((gap) => gap > 0)
  );
  const typicalLeft = median(lines.map((line) => line.left));
  const insertionIndexes: number[] = [];
  let searchFrom = 0;

  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    const previousLine = lines[index - 1];
    if (line === undefined || previousLine === undefined) {
      continue;
    }

    const verticalGap = Math.abs(previousLine.centerY - line.centerY);
    const hasLargeVerticalGap = typicalLineGap > 0
      && verticalGap > typicalLineGap * 1.4;
    const isIndented = line.left - typicalLeft
      > Math.max(8, line.height * 0.8);
    const startsParagraph = line.hasBullet
      || hasLargeVerticalGap
      || isIndented;

    if (!startsParagraph || line.text.length === 0) {
      continue;
    }

    const anchorIndex = findLineAnchor(
      annotationText,
      line.text,
      searchFrom
    );
    if (anchorIndex <= 0) {
      continue;
    }

    insertionIndexes.push(anchorIndex);
    searchFrom = anchorIndex + 1;
  }

  let restored = annotationText;
  for (const index of insertionIndexes.sort((left, right) => right - left)) {
    if (restored.slice(Math.max(0, index - 2), index).includes("\n")) {
      continue;
    }

    restored = `${restored.slice(0, index).trimEnd()}\n\n${
      restored.slice(index).trimStart()
    }`;
  }

  return restored;
}

function findLineAnchor(
  annotationText: string,
  lineText: string,
  searchFrom: number
): number {
  const words = lineText.split(/\s+/gu).filter((word) => word.length > 0);
  const maximumWords = Math.min(words.length, 8);

  for (let wordCount = maximumWords; wordCount >= 1; wordCount -= 1) {
    const anchor = words.slice(0, wordCount).join(" ");
    if (anchor.length < 8) {
      continue;
    }

    const index = annotationText.indexOf(anchor, searchFrom);
    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const middleValue = sorted[middle] ?? 0;

  if (sorted.length % 2 === 1) {
    return middleValue;
  }

  const previousValue = sorted[middle - 1] ?? middleValue;
  return (previousValue + middleValue) / 2;
}
