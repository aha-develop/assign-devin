import { EXTENSION_ID } from "../lib/constants";
import { callEventHandler, registerEventHandler } from "../lib/events";
import { parseTags } from "../lib/settings";
import * as z from "zod";

const DEVIN_API_URL = "https://api.devin.ai/v1/sessions";

// Ensure this aligns with package.json extension settings
const ExtensionSettingsSchema = z.object({
  apiKey: z.string().optional(),
  personalApiKey: z.string().optional(),
  sessionTags: z.string().optional(),
  customInstructions: z.string().optional(),
  playbookId: z.string().optional(),
});

const CreateSessionSchema = z.object({
  title: z.string(),
  prompt: z.string(),
  repository: z.string(),
  baseBranch: z.string().optional(),
  tags: z.array(z.string()).optional(),
  playbookId: z.string().optional(),
  recordReference: z.string(),
  recordType: z.literal(["Feature", "Requirement"]),
});

const DevinResponseSchema = z.object({
  session_id: z.string(),
  url: z.string(),
  is_new_session: z.nullable(z.boolean()),
});

const DevinSessionDataSchema = z.object({
  sessionId: z.string(),
  sessionUrl: z.string(),
  assignedAt: z.string(),
  title: z.string(),
  prompt: z.string(),
  repository: z.string(),
  baseBranch: z.string().optional(),
  tags: z.array(z.string()).optional(),
  playbookId: z.string().optional(),
});

export type DevinSessionData = z.infer<typeof DevinSessionDataSchema>;

export type CreateSession = z.infer<typeof CreateSessionSchema>;

async function createSession({
  prompt,
  title,
  tags,
  playbookId,
  repository,
  baseBranch,
  apiKey,
}: {
  prompt: string;
  title: string;
  tags?: string[];
  playbookId?: string;
  repository: string;
  baseBranch?: string;
  apiKey: string;
}): Promise<DevinSessionData> {
  const sessionPayload: Record<string, unknown> = {
    title,
    prompt,
    idempotent: true,
  };

  if (tags?.length) {
    sessionPayload.tags = tags;
  }
  if (playbookId) {
    sessionPayload.playbook_id = playbookId;
  }

  const response = await fetch(DEVIN_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sessionPayload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : `Devin API error (${response.status})`;
    throw new Error(message);
  }

  const result = DevinResponseSchema.safeParse(data);
  if (!result.success) {
    console.error(
      `Invalid Devin API response ${JSON.stringify(data)} ${result.error}`,
    );
    throw new Error("Invalid response from Devin API");
  }

  return {
    sessionId: result.data.session_id,
    sessionUrl: result.data.url,
    assignedAt: new Date().toISOString(),
    title,
    prompt,
    repository,
    baseBranch,
    tags,
    playbookId,
  };
}

export async function createDevinSession(
  args: CreateSession,
): Promise<DevinSessionData> {
  return callEventHandler<DevinSessionData>({
    extensionId: EXTENSION_ID,
    eventName: "createDevinSession",
    args,
  });
}

registerEventHandler({
  extensionId: EXTENSION_ID,
  eventName: "createDevinSession",
  schema: CreateSessionSchema,
  resultSchema: DevinSessionDataSchema,
  handler: async (args, { settings: rawSettings }) => {
    const { prompt, title, tags, playbookId, repository, baseBranch } = args;

    const parsedSettings = ExtensionSettingsSchema.safeParse(rawSettings);
    if (!parsedSettings.success) {
      console.error(
        `Invalid extension settings: ${parsedSettings.error.message}`,
      );
      throw new Error("Extension settings are not properly configured");
    }
    const settings = parsedSettings.data;

    const defaultTags = parseTags(settings.sessionTags);
    const effectiveTags = tags && tags.length ? tags : defaultTags;
    const effectivePlaybookId = playbookId || settings.playbookId || undefined;
    const apiKey = settings.personalApiKey ?? settings.apiKey ?? undefined;

    if (!apiKey) {
      throw new Error("API key is not configured");
    }

    const result = await createSession({
      prompt,
      title,
      tags: effectiveTags,
      playbookId: effectivePlaybookId,
      repository,
      baseBranch,
      apiKey,
    });

    return result;
  },
});
