import type { PluginLanguage } from "./i18n";

export interface ZoteroHighlightsSyncSettings {
  language: PluginLanguage;
  bookTemplatePath: string;
  annotationsTemplatePath: string;
  annotationTemplatePath: string;
}

export const DEFAULT_SETTINGS: ZoteroHighlightsSyncSettings = {
  language: "ru",
  bookTemplatePath: "",
  annotationsTemplatePath: "",
  annotationTemplatePath: ""
};
