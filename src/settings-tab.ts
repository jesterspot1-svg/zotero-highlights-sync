import {
  AbstractInputSuggest,
  App,
  normalizePath,
  PluginSettingTab,
  Setting,
  type SettingDefinitionItem,
  TFile
} from "obsidian";

import type ZoteroHighlightsSyncPlugin from "./main";

type TemplateSettingKey =
  | "bookTemplatePath"
  | "annotationsTemplatePath"
  | "annotationTemplatePath";

interface TemplateSettingDefinition {
  key: TemplateSettingKey;
  name: string;
  description: string;
}

const TEMPLATE_SETTINGS: TemplateSettingDefinition[] = [
  {
    key: "bookTemplatePath",
    name: "Шаблон заметки книги",
    description: "Шаблон для файла «Название книги»."
  },
  {
    key: "annotationsTemplatePath",
    name: "Шаблон общей заметки аннотаций",
    description: "Шаблон для файла «Annotations for Название книги»."
  },
  {
    key: "annotationTemplatePath",
    name: "Шаблон отдельной аннотации",
    description: "Шаблон заметки, создаваемой из одной пометки."
  }
];

class MarkdownFileSuggest extends AbstractInputSuggest<TFile> {
  private readonly onChoose: (file: TFile) => void;

  constructor(
    app: App,
    inputEl: HTMLInputElement,
    onChoose: (file: TFile) => void
  ) {
    super(app, inputEl);
    this.onChoose = onChoose;
  }

  protected getSuggestions(query: string): TFile[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => {
        if (normalizedQuery.length === 0) {
          return true;
        }

        return file.path.toLocaleLowerCase().includes(normalizedQuery);
      });
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(
    file: TFile,
    _event: MouseEvent | KeyboardEvent
  ): void {
    this.setValue(file.path);
    this.onChoose(file);
    this.close();
  }
}

export class ZoteroHighlightsSyncSettingTab extends PluginSettingTab {
  private readonly plugin: ZoteroHighlightsSyncPlugin;

  constructor(app: App, plugin: ZoteroHighlightsSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem<TemplateSettingKey>[] {
    return TEMPLATE_SETTINGS.map((definition) => ({
      name: definition.name,
      desc: definition.description,
      control: {
        type: "file",
        key: definition.key,
        placeholder: "Templates/Название шаблона.md",
        filter: (file) => file.extension === "md",
        validate: (value) => this.validateTemplatePath(value)
      }
    }));
  }

  getControlValue(key: string): unknown {
    if (!this.isTemplateSettingKey(key)) {
      return undefined;
    }

    return this.plugin.settings[key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (!this.isTemplateSettingKey(key) || typeof value !== "string") {
      return;
    }

    this.plugin.settings[key] = this.normalizeTemplatePath(value);
    await this.plugin.saveSettings();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("p", {
      text: "Выберите три Markdown-шаблона. Можно вводить путь вручную или выбрать файл из подсказок."
    });

    for (const definition of TEMPLATE_SETTINGS) {
      this.addTemplateSetting(definition);
    }
  }

  private addTemplateSetting(definition: TemplateSettingDefinition): void {
    const setting = new Setting(this.containerEl)
      .setName(definition.name)
      .setDesc(definition.description);

    const statusEl = setting.descEl.createDiv({
      cls: "zhs-template-status"
    });

    setting.addText((text) => {
      text
        .setPlaceholder("Templates/Название шаблона.md")
        .setValue(this.plugin.settings[definition.key])
        .onChange(async (value) => {
          const path = this.normalizeTemplatePath(value);
          this.plugin.settings[definition.key] = path;
          await this.plugin.saveSettings();
          this.updateTemplateStatus(statusEl, path);
        });

      text.inputEl.addClass("zhs-template-path-input");

      new MarkdownFileSuggest(this.app, text.inputEl, (file) => {
        text.setValue(file.path);
        this.plugin.settings[definition.key] = file.path;
        void this.plugin.saveSettings();
        this.updateTemplateStatus(statusEl, file.path);
      });
    });

    this.updateTemplateStatus(
      statusEl,
      this.plugin.settings[definition.key]
    );
  }

  private normalizeTemplatePath(value: string): string {
    const trimmed = value.trim();
    return trimmed.length === 0 ? "" : normalizePath(trimmed);
  }

  private validateTemplatePath(path: string): string | undefined {
    if (path.length === 0) {
      return "Выберите Markdown-шаблон.";
    }

    const templateFile = this.app.vault.getAbstractFileByPath(path);
    if (!(templateFile instanceof TFile) || templateFile.extension !== "md") {
      return "Markdown-файл не найден.";
    }

    return undefined;
  }

  private isTemplateSettingKey(key: string): key is TemplateSettingKey {
    return TEMPLATE_SETTINGS.some((definition) => definition.key === key);
  }

  private updateTemplateStatus(
    statusEl: HTMLElement,
    path: string
  ): void {
    statusEl.removeClass(
      "zhs-template-status-empty",
      "zhs-template-status-valid",
      "zhs-template-status-invalid"
    );

    if (path.length === 0) {
      statusEl.setText("Не задан");
      statusEl.addClass("zhs-template-status-empty");
      return;
    }

    const templateFile = this.app.vault.getAbstractFileByPath(path);

    if (templateFile instanceof TFile && templateFile.extension === "md") {
      statusEl.setText("Файл найден");
      statusEl.addClass("zhs-template-status-valid");
      return;
    }

    statusEl.setText("Markdown-файл не найден");
    statusEl.addClass("zhs-template-status-invalid");
  }
}
