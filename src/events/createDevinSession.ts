import * as z from "zod";
import { DEVIN_API_URL, EXTENSION_ID, EXTENSION_NAME } from "../lib/constants";
import { callEventHandler, registerEventHandler } from "../lib/events";
import { ExtensionSettingsSchema, parseTags } from "../lib/settings";

const CreateSessionSchema = z.object({
  title: z.string(),
  prompt: z.string(),
});

const DevinResponseSchema = z.object({
  session_id: z.string(),
  url: z.string(),
  is_new_session: z.nullable(z.boolean()),
});

export const DevinSessionDataSchema = z.object({
  sessionId: z.string(),
  sessionUrl: z.string(),
  assignedAt: z.string(),
});

export type DevinSessionData = z.infer<typeof DevinSessionDataSchema>;

export type CreateSession = z.infer<typeof CreateSessionSchema>;

async function createSession({
  prompt,
  title,
  tags,
  playbookId,
  apiKey,
}: {
  prompt: string;
  title: string;
  tags?: string[];
  playbookId?: string;
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
        : `${EXTENSION_NAME} API error (${response.status})`;
    throw new Error(message);
  }

  const result = DevinResponseSchema.safeParse(data);
  if (!result.success) {
    console.error(
      `Invalid Devin API response ${JSON.stringify(data)} ${result.error}`,
    );
    throw new Error(`Invalid response from ${EXTENSION_NAME} API`);
  }

  return {
    sessionId: result.data.session_id,
    sessionUrl: result.data.url,
    assignedAt: new Date().toISOString(),
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
    const { prompt, title } = args;

    const parsedSettings = ExtensionSettingsSchema.safeParse(rawSettings);
    if (!parsedSettings.success) {
      console.error(
        `Invalid extension settings: ${parsedSettings.error.message}`,
      );
      throw new Error(
        `${EXTENSION_NAME} extension settings are not properly configured`,
      );
    }
    const settings = parsedSettings.data;

    const { repository, baseBranch, playbookId, sessionTags } = settings;
    const tags = parseTags(sessionTags);
    const apiKey = settings.personalApiKey ?? settings.apiKey ?? undefined;

    if (!apiKey) {
      throw new Error(`${EXTENSION_NAME} API key is not configured`);
    }

    const result = await createSession({
      prompt,
      title,
      tags,
      playbookId,
      apiKey,
    });

    return result;
  },
});
