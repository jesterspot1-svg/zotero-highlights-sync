import {
  AbstractInputSuggest,
  App,
  normalizePath,
  PluginSettingTab,
  Setting,
  type SettingDefinitionItem,
  TFile
} from "obsidian";

import {
  isPluginLanguage,
  translate,
  type TranslationKey
} from "./i18n";
import type ZoteroHighlightsSyncPlugin from "./main";

type SettingKey =
  | "language"
  | "bookTemplatePath"
  | "annotationsTemplatePath"
  | "annotationTemplatePath";

type TemplateSettingKey = Exclude<SettingKey, "language">;

interface TemplateSettingDefinition {
  key: TemplateSettingKey;
  nameKey: TranslationKey;
  descriptionKey: TranslationKey;
}

const TEMPLATE_SETTINGS: TemplateSettingDefinition[] = [
  {
    key: "bookTemplatePath",
    nameKey: "settings.template.book.name",
    descriptionKey: "settings.template.book.description"
  },
  {
    key: "annotationsTemplatePath",
    nameKey: "settings.template.annotations.name",
    descriptionKey: "settings.template.annotations.description"
  },
  {
    key: "annotationTemplatePath",
    nameKey: "settings.template.annotation.name",
    descriptionKey: "settings.template.annotation.description"
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
        return normalizedQuery.length === 0
          || file.path.toLocaleLowerCase().includes(normalizedQuery);
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

  getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
    return [
      {
        name: "Zotero Highlights Sync",
        desc: translate("settings.plugin.description"),
        searchable: false
      },
      {
        name: translate("settings.language.name"),
        desc: translate("settings.language.description"),
        control: {
          type: "dropdown",
          key: "language",
          options: {
            ru: translate("settings.language.ru"),
            en: translate("settings.language.en")
          }
        }
      },
      {
        type: "group",
        heading: translate("settings.templates.intro"),
        items: TEMPLATE_SETTINGS.map((definition) => ({
          name: translate(definition.nameKey),
          desc: translate(definition.descriptionKey),
          control: {
            type: "file",
            key: definition.key,
            placeholder: translate("settings.template.placeholder"),
            filter: (file: TFile) => file.extension === "md",
            validate: (value: string) => {
              return this.validateTemplatePath(value);
            }
          }
        }))
      }
    ];
  }

  getControlValue(key: string): unknown {
    if (!isSettingKey(key)) {
      return undefined;
    }

    return this.plugin.settings[key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (!isSettingKey(key) || typeof value !== "string") {
      return;
    }

    if (key === "language") {
      if (!isPluginLanguage(value)) {
        return;
      }

      await this.plugin.changeLanguage(value);
      return;
    }

    this.plugin.settings[key] = normalizeTemplatePath(value);
    await this.plugin.saveSettings();
  }

  /**
   * Compatibility renderer for Obsidian 1.12.7. Obsidian 1.13+ uses
   * getSettingDefinitions() and does not call this method.
   */
  display(): void {
    this.renderLegacySettings();
  }

  private renderLegacySettings(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("p", {
      text: translate("settings.plugin.description")
    });

    new Setting(containerEl)
      .setName(translate("settings.language.name"))
      .setDesc(translate("settings.language.description"))
      .addDropdown((dropdown) => {
        dropdown
          .addOption("ru", translate("settings.language.ru"))
          .addOption("en", translate("settings.language.en"))
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            if (!isPluginLanguage(value)) {
              return;
            }

            await this.plugin.changeLanguage(value);
            this.renderLegacySettings();
          });
      });

    containerEl.createEl("p", {
      text: translate("settings.templates.intro")
    });

    for (const definition of TEMPLATE_SETTINGS) {
      this.addLegacyTemplateSetting(definition);
    }
  }

  private addLegacyTemplateSetting(
    definition: TemplateSettingDefinition
  ): void {
    const setting = new Setting(this.containerEl)
      .setName(translate(definition.nameKey))
      .setDesc(translate(definition.descriptionKey));

    const statusEl = setting.descEl.createDiv({
      cls: "zhs-template-status"
    });

    setting.addText((text) => {
      text
        .setPlaceholder(translate("settings.template.placeholder"))
        .setValue(this.plugin.settings[definition.key])
        .onChange(async (value) => {
          const path = normalizeTemplatePath(value);
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

  private validateTemplatePath(path: string): string | undefined {
    const normalizedPath = normalizeTemplatePath(path);
    if (normalizedPath.length === 0) {
      return translate("settings.template.select");
    }

    const templateFile = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (!(templateFile instanceof TFile) || templateFile.extension !== "md") {
      return translate("settings.template.notFound");
    }

    return undefined;
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
      statusEl.setText(translate("settings.template.status.empty"));
      statusEl.addClass("zhs-template-status-empty");
      return;
    }

    const templateFile = this.app.vault.getAbstractFileByPath(path);
    if (templateFile instanceof TFile && templateFile.extension === "md") {
      statusEl.setText(translate("settings.template.status.valid"));
      statusEl.addClass("zhs-template-status-valid");
      return;
    }

    statusEl.setText(translate("settings.template.notFound"));
    statusEl.addClass("zhs-template-status-invalid");
  }
}

function isSettingKey(value: string): value is SettingKey {
  return value === "language"
    || TEMPLATE_SETTINGS.some((definition) => definition.key === value);
}

function normalizeTemplatePath(value: string): string {
  const trimmed = value.trim();
  return trimmed.length === 0 ? "" : normalizePath(trimmed);
}
