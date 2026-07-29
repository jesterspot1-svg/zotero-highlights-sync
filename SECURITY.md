# Security policy

## Reporting a vulnerability

Please do not publish sensitive vulnerability details in a public issue.
Contact the maintainer privately through the security reporting options of the
project's GitHub repository.

## Data handling

The plugin is designed to communicate only with the Zotero local API on
`localhost:23119`. It reads the selected local PDF attachment to restore text
layout and page count, and it reads or writes Markdown files in the active
Obsidian vault. It does not include telemetry or analytics and does not send
PDF or vault contents to external services.
