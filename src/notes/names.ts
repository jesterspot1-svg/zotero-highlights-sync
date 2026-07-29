export function sanitizeNoteName(
  title: string,
  fallback: string
): string {
  const sanitized = title
    .replace(/[\\/:*?"<>|[\]#^]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[.\s]+$/gu, "")
    .slice(0, 160)
    .trimEnd();
  const filename = sanitized.length > 0 ? sanitized : fallback;

  return isWindowsReservedName(filename)
    ? `${filename} — заметка`
    : filename;
}

export function createAnnotationNoteName(
  text: string,
  annotationKey: string
): string {
  const words = text.trim().split(/\s+/gu).filter((word) => word.length > 0);
  const firstWords = words.slice(0, 7).join(" ");

  return sanitizeNoteName(
    firstWords,
    `Пометка ${annotationKey}`
  );
}

function isWindowsReservedName(filename: string): boolean {
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(filename);
}
