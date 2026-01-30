import * as z from "zod/mini";

// Ensure this aligns with package.json extension settings
export const ExtensionSettingsSchema = z.object({
  apiKey: z.optional(z.string()), // Not available client side
  personalApiKey: z.optional(z.string()), // Not available client side
  repository: z.string(),
  baseBranch: z.string(),
  sessionTags: z.optional(z.string()),
  customInstructions: z.optional(z.string()),
  playbookId: z.optional(z.string()),
});

export type ExtensionSettings = z.infer<typeof ExtensionSettingsSchema>;

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
