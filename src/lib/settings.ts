export function parseTags(value?: string | string[]): string[] | undefined {
  if (Array.isArray(value)) {
    const cleaned = value.map((tag) => tag.trim()).filter(Boolean);
    return cleaned.length ? Array.from(new Set(cleaned)) : undefined;
  }

  if (!value) {
    return undefined;
  }

  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length ? Array.from(new Set(parts)) : undefined;
}
