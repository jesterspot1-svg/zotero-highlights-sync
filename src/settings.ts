import {
  isPluginLanguage,
  type PluginLanguage
} from "./i18n";

export interface ZoteroHighlightsSyncSettings {
  language: PluginLanguage;
  bookTemplatePath: string;
  annotationsTemplatePath: string;
  annotationTemplatePath: string;
}

export const DEFAULT_SETTINGS: ZoteroHighlightsSyncSettings = {
  language: "en",
  bookTemplatePath: "",
  annotationsTemplatePath: "",
  annotationTemplatePath: ""
};

export function resolvePluginLanguage(
  savedSettings: Partial<ZoteroHighlightsSyncSettings> | null
): PluginLanguage {
  if (isPluginLanguage(savedSettings?.language)) {
    return savedSettings.language;
  }

  return savedSettings === null ? DEFAULT_SETTINGS.language : "ru";
}
