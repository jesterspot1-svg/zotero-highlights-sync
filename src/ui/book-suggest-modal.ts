import {
  App,
  FuzzySuggestModal
} from "obsidian";

import { translate } from "../i18n";
import type { ZoteroBook } from "../zotero";

export class ZoteroBookSuggestModal extends FuzzySuggestModal<ZoteroBook> {
  private readonly books: ZoteroBook[];
  private readonly onChoose: (book: ZoteroBook) => void;

  constructor(
    app: App,
    books: ZoteroBook[],
    onChoose: (book: ZoteroBook) => void
  ) {
    super(app);
    this.books = books;
    this.onChoose = onChoose;

    this.setPlaceholder(translate("modal.book.placeholder"));
    this.setInstructions([
      {
        command: "↑↓",
        purpose: translate("modal.instruction.select")
      },
      {
        command: "↵",
        purpose: translate("modal.instruction.confirm")
      },
      {
        command: "esc",
        purpose: translate("modal.instruction.close")
      }
    ]);
  }

  getItems(): ZoteroBook[] {
    return this.books;
  }

  getItemText(book: ZoteroBook): string {
    return [
      book.title,
      book.authors.join(", "),
      book.year
    ]
      .filter((part) => part.length > 0)
      .join(" — ");
  }

  renderSuggestion(
    match: Parameters<
      FuzzySuggestModal<ZoteroBook>["renderSuggestion"]
    >[0],
    el: HTMLElement
  ): void {
    const book = match.item;

    el.createDiv({
      cls: "zhs-book-suggestion-title",
      text: book.title
    });

    const details = [
      book.authors.join(", "),
      book.year
    ].filter((part) => part.length > 0);

    el.createDiv({
      cls: "zhs-book-suggestion-details",
      text: details.length > 0
        ? details.join(" · ")
        : translate("modal.book.noDetails")
    });
  }

  onChooseItem(book: ZoteroBook): void {
    this.onChoose(book);
  }
}
