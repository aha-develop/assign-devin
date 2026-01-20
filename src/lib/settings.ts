import * as z from "zod";

// Ensure this aligns with package.json extension settings
export const ExtensionSettingsSchema = z.object({
  apiKey: z.string().optional(), // Not available client side
  personalApiKey: z.string().optional(), // Not available client side
  repository: z.string(),
  baseBranch: z.string(),
  sessionTags: z.string().optional(),
  customInstructions: z.string().optional(),
  playbookId: z.string().optional(),
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
