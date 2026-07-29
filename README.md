# Zotero Highlights Sync

Zotero Highlights Sync is a desktop-only Obsidian plugin for creating linked
book notes and synchronizing PDF annotations from a locally running Zotero
installation.

## Features

- Select a book and its PDF attachment from Zotero.
- Create a book note and a separate `Annotations for Book title` note from
  user-selected templates.
- Synchronize annotation text, Zotero comments, colors, pages, ordering, and
  deep links to the exact annotation.
- Restore paragraphs and list boundaries from the local PDF when Zotero
  returns flattened annotation text.
- Keep stable creation numbers while displaying annotations in book order.
- Create, open, and update one atomic note per annotation.
- Create all missing atomic notes with an Obsidian command that can be assigned
  to a hotkey.
- Preserve manually renamed atomic notes by identifying them through
  `annotation_key`.
- Preserve user-authored content outside managed synchronization markers.
- Keep generated notes in the vault root without creating folders.

## Requirements

- Obsidian 1.12.7 or newer on desktop
- Zotero Desktop running on the same computer
- Zotero local API enabled:
  **Settings → Advanced → Allow other applications on this computer to
  communicate with Zotero**
- A PDF attachment for the selected Zotero book

## Setup

1. Create three Markdown templates in the vault:
   - book note;
   - annotations note;
   - atomic annotation note.
2. Open **Settings → Zotero Highlights Sync**.
3. Select the three template files.
4. Run **Zotero Highlights Sync: Создание книги**.
5. Select a Zotero book and, when needed, its PDF attachment.
6. Open the generated annotations note in Reading view and select
   **Обновить пометки**.

To create all missing atomic notes, assign a hotkey to
**Zotero Highlights Sync: Создать отдельные заметки для всех пометок** in
Obsidian's Hotkeys settings.

## Synchronization behavior

- Synchronization is manual and starts only when requested by the user.
- The annotations note is ordered by position in the PDF.
- An annotation number is assigned when the annotation is first imported and
  remains stable even when a later annotation is inserted earlier in the book.
- Changing annotation text, comments, color, page, or modification date updates
  the managed content of existing atomic notes.
- Deleting an annotation in Zotero removes it from the annotations note.
- An existing atomic note is retained and receives `source_deleted: true`.
- Atomic note filenames are never changed during updates.

## Template variables

The plugin replaces only variables beginning with `{{zhs.`. Templater
expressions such as `<% ... %>` remain untouched.

### Book template

- `{{zhs.book.title}}`
- `{{zhs.book.title_yaml}}`
- `{{zhs.book.authors_yaml}}`
- `{{zhs.book.year}}`
- `{{zhs.book.total_pages}}`
- `{{zhs.book.item_key_yaml}}`
- `{{zhs.book.zotero_link_yaml}}`
- `{{zhs.pdf.attachment_key_yaml}}`
- `{{zhs.note.annotations_link_yaml}}`

### Annotations template

- `{{zhs.book.item_key_yaml}}`
- `{{zhs.pdf.attachment_key_yaml}}`
- `{{zhs.note.book_link_yaml}}`
- `{{zhs.annotations.count}}`
- `{{zhs.sync.last_sync_yaml}}`
- `{{zhs.annotations.toolbar}}`
- `{{zhs.annotations.managed_block}}`

The toolbar and managed block variables are required for synchronization.

### Atomic annotation template

- `{{zhs.annotation.number}}`
- `{{zhs.annotation.key_yaml}}`
- `{{zhs.annotation.page_yaml}}`
- `{{zhs.annotation.color_yaml}}`
- `{{zhs.annotation.date_added_yaml}}`
- `{{zhs.annotation.date_modified_yaml}}`
- `{{zhs.annotation.zotero_link_yaml}}`
- `{{zhs.annotation.short_title}}`
- `{{zhs.annotation.managed_block}}`
- `{{zhs.note.book_link_yaml}}`
- `{{zhs.note.annotations_link_yaml}}`

The managed block variable is required for updating atomic notes.

## Privacy and data access

- The plugin communicates only with Zotero's local API at
  `http://localhost:23119`.
- It does not require a Zotero API key or cloud account.
- It does not send telemetry, analytics, vault contents, PDF contents, or
  annotation data to external services.
- It reads the three selected template files.
- It reads the selected local PDF attachment to restore paragraph and list
  boundaries.
- It reads Zotero's local full-text metadata to determine the page count when
  the Zotero book item does not contain one.
- It creates and updates Markdown files only inside the active vault.

## Installation from a release

Copy these files into
`Vault/.obsidian/plugins/zotero-highlights-sync/`:

- `main.js`
- `manifest.json`
- `styles.css`

Then reload Obsidian and enable **Zotero Highlights Sync** under Community
plugins.

## Development

```sh
npm ci
npm run audit:production
npm run lint
npm run build
```

## License

[MIT](LICENSE). The bundled PDF parsing dependency, Mozilla PDF.js, is
available under the Apache License 2.0; see
[THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).

---

## Русский

Zotero Highlights Sync — настольный плагин Obsidian для создания связанных
заметок книг и ручной синхронизации PDF-пометок из локально запущенного Zotero.

Плагин создаёт заметку книги, общую заметку `Annotations for...` и отдельные
заметки пометок по выбранным пользователем шаблонам. Он сохраняет порядок,
цвета, комментарии, страницы, ссылки на конкретные места PDF и не изменяет
пользовательский текст вне служебных блоков.

Плагин обращается только к локальному API Zotero, не использует телеметрию и
не отправляет содержимое хранилища или PDF во внешние сервисы.
