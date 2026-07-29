import {
  App,
  FuzzySuggestModal
} from "obsidian";

import type { ZoteroPdfAttachment } from "../zotero";

export class ZoteroPdfSuggestModal
  extends FuzzySuggestModal<ZoteroPdfAttachment> {
  private readonly attachments: ZoteroPdfAttachment[];
  private readonly onChoose: (attachment: ZoteroPdfAttachment) => void;

  constructor(
    app: App,
    attachments: ZoteroPdfAttachment[],
    onChoose: (attachment: ZoteroPdfAttachment) => void
  ) {
    super(app);
    this.attachments = attachments;
    this.onChoose = onChoose;

    this.setPlaceholder("Выберите вложение PDF");
    this.setInstructions([
      {
        command: "↑↓",
        purpose: "выбрать"
      },
      {
        command: "↵",
        purpose: "подтвердить"
      },
      {
        command: "esc",
        purpose: "закрыть"
      }
    ]);
  }

  getItems(): ZoteroPdfAttachment[] {
    return this.attachments;
  }

  getItemText(attachment: ZoteroPdfAttachment): string {
    return [
      attachment.title,
      attachment.filename
    ]
      .filter((part) => part.length > 0)
      .join(" — ");
  }

  renderSuggestion(
    match: Parameters<
      FuzzySuggestModal<ZoteroPdfAttachment>["renderSuggestion"]
    >[0],
    el: HTMLElement
  ): void {
    const attachment = match.item;

    el.createDiv({
      cls: "zhs-book-suggestion-title",
      text: attachment.title
    });

    el.createDiv({
      cls: "zhs-book-suggestion-details",
      text: attachment.filename || `Ключ Zotero: ${attachment.key}`
    });
  }

  onChooseItem(attachment: ZoteroPdfAttachment): void {
    this.onChoose(attachment);
  }
}
