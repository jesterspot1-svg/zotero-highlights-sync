# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-07-30

### Added

- Added a Russian and English language selector to the plugin settings.
- Localized commands, settings, buttons, notices, picker dialogs, validation
  messages, and generated annotation labels.

### Changed

- Added settings compatibility for both Obsidian 1.12.7 and the declarative
  settings API introduced in Obsidian 1.13.
- Expanded the English and Russian usage documentation.
- Kept existing note paths, synchronization markers, and template variable
  names stable when switching languages.

## [1.0.1] - 2026-07-29

### Changed

- Added explicit local types around Node.js filesystem, URL, and HTTP APIs.
- Removed unsafe TypeScript operations reported by the Community plugin
  scanner without changing Zotero synchronization behavior.

## [1.0.0] - 2026-07-29

### Changed

- Prepared the first stable community-directory release.
- Updated the Obsidian lint rules and aligned conditional commands with the
  recommended callback API.
- Expanded the README disclosures for local network and out-of-vault PDF
  access.
- Improved release validation and release-note generation.

## [0.1.2] - 2026-07-29

### Changed

- Recreated the publication release with a lightweight Git tag for community
  directory compatibility.

## [0.1.1] - 2026-07-29

### Changed

- Set the minimum supported Obsidian version to the tested stable release
  1.12.7.

## [0.1.0] - 2026-07-29

### Added

- Searchable Zotero book and PDF selection.
- Configurable templates for book, annotations, and atomic annotation notes.
- Manual synchronization of annotation text, comments, colors, pages, order,
  modification data, and Zotero deep links.
- Paragraph and list restoration using the selected local PDF.
- Stable annotation numbering.
- Per-annotation Create, Open, and Update actions.
- Command for creating all missing atomic notes.
- Preservation of renamed atomic notes through `annotation_key`.
- Deleted-source tracking through `source_deleted`.
- Automatic page-count fallback from the Zotero full-text index.
- Publication, quality, and release automation files.
