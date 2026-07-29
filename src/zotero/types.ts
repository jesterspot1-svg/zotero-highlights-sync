export interface ZoteroBook {
  key: string;
  title: string;
  authors: string[];
  year: string;
  totalPages: string;
  publisher: string;
  isbn: string;
  language: string;
}

export interface ZoteroPdfAttachment {
  key: string;
  title: string;
  filename: string;
  linkMode: string;
}

export interface ZoteroAnnotation {
  key: string;
  parentItemKey: string;
  type: string;
  text: string;
  comment: string;
  color: string;
  pageLabel: string;
  sortIndex: string;
  position: string;
  dateAdded: string;
  dateModified: string;
}

export type ZoteroConnectionFailure =
  | "not-running"
  | "api-disabled"
  | "invalid-response";

export class ZoteroConnectionError extends Error {
  readonly failure: ZoteroConnectionFailure;

  constructor(failure: ZoteroConnectionFailure, message: string) {
    super(message);
    this.name = "ZoteroConnectionError";
    this.failure = failure;
  }
}
