import { request as nodeHttpRequest } from "http";
import { fileURLToPath } from "url";

import { requestUrl } from "obsidian";

import { translate } from "../i18n";
import {
  type ZoteroAnnotation,
  type ZoteroBook,
  type ZoteroPdfAttachment,
  ZoteroConnectionError
} from "./types";

const ZOTERO_API_BASE_URL = "http://localhost:23119/api";
const ZOTERO_API_VERSION = "3";
const ZOTERO_REQUEST_TIMEOUT_MS = 10000;
const ZOTERO_PAGE_SIZE = 100;

interface LocalHttpResponse {
  status: number;
  text: string;
  headers: Record<string, string>;
}

interface NodeHttpResponse {
  statusCode?: number;
  headers: Record<string, string | string[] | undefined>;
  setEncoding(encoding: "utf8"): void;
  on(event: "data", listener: (chunk: string) => void): NodeHttpResponse;
  on(event: "end", listener: () => void): NodeHttpResponse;
  on(
    event: "error",
    listener: (error: unknown) => void
  ): NodeHttpResponse;
}

interface NodeHttpRequest {
  on(event: "timeout", listener: () => void): NodeHttpRequest;
  on(
    event: "error",
    listener: (error: unknown) => void
  ): NodeHttpRequest;
  destroy(error?: Error): void;
  end(): void;
}

interface NodeHttpRequestOptions {
  method: "GET";
  headers: Record<string, string>;
  timeout: number;
}

type RequestWithNodeHttp = (
  url: string,
  options: NodeHttpRequestOptions,
  listener: (response: NodeHttpResponse) => void
) => NodeHttpRequest;

type ConvertFileUrlToPath = (url: URL) => string;

const sendNodeHttpRequest = nodeHttpRequest as unknown as RequestWithNodeHttp;
const convertFileUrlToPath = fileURLToPath as unknown as ConvertFileUrlToPath;

interface ZoteroCreator {
  creatorType: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

interface ZoteroBookApiData {
  itemType: "book";
  title?: string;
  creators?: ZoteroCreator[];
  date?: string;
  numPages?: string;
  publisher?: string;
  ISBN?: string;
  language?: string;
}

interface ZoteroBookApiItem {
  key: string;
  data: ZoteroBookApiData;
}

interface ZoteroAttachmentApiData {
  itemType: "attachment";
  title?: string;
  filename?: string;
  contentType?: string;
  linkMode?: string;
}

interface ZoteroAttachmentApiItem {
  key: string;
  data: ZoteroAttachmentApiData;
}

interface ZoteroAnnotationApiData {
  itemType: "annotation";
  parentItem?: string;
  annotationType?: string;
  annotationText?: string;
  annotationComment?: string;
  annotationColor?: string;
  annotationPageLabel?: string;
  annotationSortIndex?: string;
  annotationPosition?: string;
  dateAdded?: string;
  dateModified?: string;
}

interface ZoteroAnnotationApiItem {
  key: string;
  data: ZoteroAnnotationApiData;
}

export class ZoteroClient {
  async getBooks(): Promise<ZoteroBook[]> {
    const query = new URLSearchParams({
      itemType: "book",
      sort: "title",
      direction: "asc"
    });

    try {
      const response = await requestLocalZotero(
        `${ZOTERO_API_BASE_URL}/users/0/items/top?${query.toString()}`
      );

      if (response.status === 403) {
        throw new ZoteroConnectionError(
          "api-disabled",
          translate("zotero.apiDisabled")
        );
      }

      if (response.status < 200 || response.status >= 300) {
        throw new ZoteroConnectionError(
          "invalid-response",
          translate("zotero.http", { status: response.status })
        );
      }

      const payload = parseJson(response.text);
      if (!Array.isArray(payload)) {
        throw new ZoteroConnectionError(
          "invalid-response",
          translate("zotero.invalidBooks")
        );
      }

      return payload
        .filter(isZoteroBookApiItem)
        .map(normalizeBook)
        .sort(compareBooks);
    } catch (error: unknown) {
      throw normalizeConnectionError(error);
    }
  }

  async getPdfAttachments(bookKey: string): Promise<ZoteroPdfAttachment[]> {
    const query = new URLSearchParams({
      itemType: "attachment"
    });
    const encodedBookKey = encodeURIComponent(bookKey);

    try {
      const response = await requestLocalZotero(
        `${ZOTERO_API_BASE_URL}/users/0/items/${encodedBookKey}/children?${query.toString()}`
      );

      if (response.status === 403) {
        throw new ZoteroConnectionError(
          "api-disabled",
          translate("zotero.apiDisabled")
        );
      }

      if (response.status < 200 || response.status >= 300) {
        throw new ZoteroConnectionError(
          "invalid-response",
          translate("zotero.httpAttachments", {
            status: response.status
          })
        );
      }

      const payload = parseJson(response.text);
      if (!Array.isArray(payload)) {
        throw new ZoteroConnectionError(
          "invalid-response",
          translate("zotero.invalidAttachments")
        );
      }

      return payload
        .filter(isZoteroAttachmentApiItem)
        .filter(isPdfAttachment)
        .map(normalizePdfAttachment)
        .sort(comparePdfAttachments);
    } catch (error: unknown) {
      throw normalizeConnectionError(error);
    }
  }

  async getAnnotations(attachmentKey: string): Promise<ZoteroAnnotation[]> {
    const encodedAttachmentKey = encodeURIComponent(attachmentKey);
    const annotations: ZoteroAnnotation[] = [];
    let start = 0;

    try {
      while (true) {
        const query = new URLSearchParams({
          itemType: "annotation",
          limit: String(ZOTERO_PAGE_SIZE),
          start: String(start)
        });
        const response = await requestLocalZotero(
          `${ZOTERO_API_BASE_URL}/users/0/items/${encodedAttachmentKey}/children?${query.toString()}`
        );

        if (response.status === 403) {
          throw new ZoteroConnectionError(
            "api-disabled",
            translate("zotero.apiDisabled")
          );
        }

        if (response.status < 200 || response.status >= 300) {
          throw new ZoteroConnectionError(
            "invalid-response",
            translate("zotero.httpAnnotations", {
              status: response.status
            })
          );
        }

        const payload = parseJson(response.text);
        if (!Array.isArray(payload)) {
          throw new ZoteroConnectionError(
            "invalid-response",
            translate("zotero.invalidAnnotations")
          );
        }

        annotations.push(
          ...payload
            .filter(isZoteroAnnotationApiItem)
            .map(normalizeAnnotation)
        );

        if (payload.length < ZOTERO_PAGE_SIZE) {
          break;
        }

        start += ZOTERO_PAGE_SIZE;
      }

      return annotations.sort(compareAnnotations);
    } catch (error: unknown) {
      throw normalizeConnectionError(error);
    }
  }

  async getAttachmentFilePath(attachmentKey: string): Promise<string> {
    const encodedAttachmentKey = encodeURIComponent(attachmentKey);

    try {
      const response = await requestWithNodeHttp(
        `${ZOTERO_API_BASE_URL}/users/0/items/${encodedAttachmentKey}/file`
      );
      const location = response.headers.location;

      if (
        (response.status !== 301 && response.status !== 302)
        || location === undefined
      ) {
        throw new ZoteroConnectionError(
          "invalid-response",
          translate("zotero.noPdfPath")
        );
      }

      const fileUrl = new URL(location);
      if (fileUrl.protocol !== "file:") {
        throw new ZoteroConnectionError(
          "invalid-response",
          translate("zotero.unsafePdfPath")
        );
      }

      return convertFileUrlToPath(fileUrl);
    } catch (error: unknown) {
      throw normalizeConnectionError(error);
    }
  }

  async getAttachmentPageCount(attachmentKey: string): Promise<string> {
    const encodedAttachmentKey = encodeURIComponent(attachmentKey);

    try {
      const response = await requestLocalZotero(
        `${ZOTERO_API_BASE_URL}/users/0/items/${encodedAttachmentKey}/fulltext`
      );

      if (response.status === 404) {
        return "";
      }

      if (response.status === 403) {
        throw new ZoteroConnectionError(
          "api-disabled",
          translate("zotero.apiDisabled")
        );
      }

      if (response.status < 200 || response.status >= 300) {
        throw new ZoteroConnectionError(
          "invalid-response",
          translate("zotero.httpPageCount", {
            status: response.status
          })
        );
      }

      const payload = parseJson(response.text);
      if (!isRecord(payload)) {
        return "";
      }

      const totalPages = payload.totalPages;
      if (
        typeof totalPages === "number"
        && Number.isSafeInteger(totalPages)
        && totalPages > 0
      ) {
        return String(totalPages);
      }

      return typeof totalPages === "string"
        ? totalPages.trim()
        : "";
    } catch (error: unknown) {
      throw normalizeConnectionError(error);
    }
  }
}

async function requestLocalZotero(url: string): Promise<LocalHttpResponse> {
  try {
    const response = await requestUrl({
      url,
      method: "GET",
      headers: {
        "Zotero-API-Version": ZOTERO_API_VERSION
      },
      throw: false
    });

    return {
      status: response.status,
      text: response.text,
      headers: response.headers
    };
  } catch (requestUrlError: unknown) {
    try {
      return await requestWithNodeHttp(url);
    } catch (nodeHttpError: unknown) {
      const requestUrlMessage = getErrorMessage(requestUrlError);
      const nodeHttpMessage = getErrorMessage(nodeHttpError);

      throw new Error(
        [
          requestUrlMessage.length > 0
            ? `Obsidian requestUrl: ${requestUrlMessage}`
            : "",
          nodeHttpMessage.length > 0
            ? `Node HTTP: ${nodeHttpMessage}`
            : ""
        ]
          .filter((message) => message.length > 0)
          .join("; ")
      );
    }
  }
}

function requestWithNodeHttp(url: string): Promise<LocalHttpResponse> {
  return new Promise((resolve, reject) => {
    const request = sendNodeHttpRequest(
      url,
      {
        method: "GET",
        headers: {
          "Zotero-API-Version": ZOTERO_API_VERSION
        },
        timeout: ZOTERO_REQUEST_TIMEOUT_MS
      },
      (response) => {
        response.setEncoding("utf8");
        let responseText = "";

        response.on("data", (chunk: string) => {
          responseText += chunk;
        });

        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            text: responseText,
            headers: normalizeNodeHeaders(response.headers)
          });
        });

        response.on("error", (error: unknown) => {
          reject(toError(error));
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error(translate("zotero.timeout")));
    });
    request.on("error", (error: unknown) => {
      reject(toError(error));
    });
    request.end();
  });
}

function normalizeNodeHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      normalized[name.toLowerCase()] = value;
    } else if (Array.isArray(value)) {
      normalized[name.toLowerCase()] = value.join(", ");
    }
  }

  return normalized;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ZoteroConnectionError(
      "invalid-response",
      translate("zotero.invalidJson")
    );
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "";
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error(getErrorMessage(error) || "Unknown Zotero HTTP error.");
}

function isZoteroBookApiItem(value: unknown): value is ZoteroBookApiItem {
  if (!isRecord(value) || typeof value.key !== "string") {
    return false;
  }

  const data = value.data;
  return isRecord(data) && data.itemType === "book";
}

function isZoteroAttachmentApiItem(
  value: unknown
): value is ZoteroAttachmentApiItem {
  if (!isRecord(value) || typeof value.key !== "string") {
    return false;
  }

  const data = value.data;
  return isRecord(data) && data.itemType === "attachment";
}

function isZoteroAnnotationApiItem(
  value: unknown
): value is ZoteroAnnotationApiItem {
  if (!isRecord(value) || typeof value.key !== "string") {
    return false;
  }

  const data = value.data;
  return isRecord(data) && data.itemType === "annotation";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeBook(item: ZoteroBookApiItem): ZoteroBook {
  const creators = Array.isArray(item.data.creators)
    ? item.data.creators
    : [];

  return {
    key: item.key,
    title: readText(item.data.title, translate("zotero.untitled")),
    authors: creators
      .filter((creator) => creator.creatorType === "author")
      .map(formatCreator)
      .filter((creator) => creator.length > 0),
    year: extractYear(item.data.date),
    totalPages: readText(item.data.numPages),
    publisher: readText(item.data.publisher),
    isbn: readText(item.data.ISBN),
    language: readText(item.data.language)
  };
}

function isPdfAttachment(item: ZoteroAttachmentApiItem): boolean {
  return item.data.contentType?.toLowerCase() === "application/pdf"
    || item.data.filename?.toLowerCase().endsWith(".pdf") === true;
}

function normalizePdfAttachment(
  item: ZoteroAttachmentApiItem
): ZoteroPdfAttachment {
  const filename = readText(item.data.filename);

  return {
    key: item.key,
    title: readText(item.data.title, filename || "PDF"),
    filename,
    linkMode: readText(item.data.linkMode)
  };
}

function normalizeAnnotation(
  item: ZoteroAnnotationApiItem
): ZoteroAnnotation {
  return {
    key: item.key,
    parentItemKey: readText(item.data.parentItem),
    type: readText(item.data.annotationType),
    text: readText(item.data.annotationText),
    comment: readText(item.data.annotationComment),
    color: readText(item.data.annotationColor),
    pageLabel: readText(item.data.annotationPageLabel),
    sortIndex: readText(item.data.annotationSortIndex),
    position: readText(item.data.annotationPosition),
    dateAdded: readText(item.data.dateAdded),
    dateModified: readText(item.data.dateModified)
  };
}

function formatCreator(creator: ZoteroCreator): string {
  const singleFieldName = readText(creator.name);
  if (singleFieldName.length > 0) {
    return singleFieldName;
  }

  return [
    readText(creator.firstName),
    readText(creator.lastName)
  ]
    .filter((part) => part.length > 0)
    .join(" ");
}

function extractYear(date: string | undefined): string {
  const normalizedDate = readText(date);
  const match = normalizedDate.match(/\b(?:1[5-9]\d{2}|20\d{2}|21\d{2})\b/u);
  return match?.[0] ?? "";
}

function readText(value: string | undefined, fallback = ""): string {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : fallback;
}

function compareBooks(left: ZoteroBook, right: ZoteroBook): number {
  return left.title.localeCompare(right.title, ["ru", "en"], {
    sensitivity: "base"
  });
}

function comparePdfAttachments(
  left: ZoteroPdfAttachment,
  right: ZoteroPdfAttachment
): number {
  return `${left.title} ${left.filename}`.localeCompare(
    `${right.title} ${right.filename}`,
    ["ru", "en"],
    {
      sensitivity: "base"
    }
  );
}

function compareAnnotations(
  left: ZoteroAnnotation,
  right: ZoteroAnnotation
): number {
  const byPosition = left.sortIndex.localeCompare(
    right.sortIndex,
    "en",
    {
      numeric: true
    }
  );

  return byPosition !== 0
    ? byPosition
    : left.key.localeCompare(right.key, "en");
}

function normalizeConnectionError(error: unknown): ZoteroConnectionError {
  if (error instanceof ZoteroConnectionError) {
    return error;
  }

  const details = getErrorMessage(error);
  return new ZoteroConnectionError(
    "not-running",
    details.length > 0
      ? translate("zotero.connectionFailed", { details })
      : translate("zotero.connectionFailedShort")
  );
}
