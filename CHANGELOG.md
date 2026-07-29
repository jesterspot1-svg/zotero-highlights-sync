# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
