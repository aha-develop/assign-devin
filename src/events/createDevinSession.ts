import * as z from "zod/mini";
import base64 from "base-64";
import { DEVIN_API_URL, EXTENSION_ID, EXTENSION_NAME } from "../lib/constants";
import { callEventHandler, registerEventHandler } from "../lib/events";
import type { RecordAttachment } from "../lib/buildSessionPrompt";
import { ExtensionSettingsSchema, parseTags } from "../lib/settings";

const AttachmentSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  downloadUrl: z.string(),
  base64Data: z.optional(z.string()),
});

const DEVIN_SESSIONS_URL = `${DEVIN_API_URL}sessions`;
const DEVIN_ATTACHMENTS_URL = `${DEVIN_API_URL}attachments`;

const CreateSessionSchema = z.object({
  title: z.string(),
  prompt: z.string(),
  attachments: z.optional(z.array(AttachmentSchema)),
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

// Converts a string to bytes (replacement for TextEncoder which isn't available)
function stringToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

// We need to resort to this manual multipart/form-data construction
// as the lambda environment doesn't support Blob or FormData APIs.
function buildMultipartBody(
  fileBytes: Uint8Array,
  fileName: string,
  contentType: string,
  boundary: string,
): Uint8Array {
  const header =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const headerBytes = stringToBytes(header);
  const footerBytes = stringToBytes(footer);

  const body = new Uint8Array(
    headerBytes.length + fileBytes.length + footerBytes.length,
  );
  body.set(headerBytes, 0);
  body.set(fileBytes, headerBytes.length);
  body.set(footerBytes, headerBytes.length + fileBytes.length);

  return body;
}

async function uploadAttachment(
  attachment: RecordAttachment,
  apiKey: string,
): Promise<string> {
  if (!attachment.base64Data) {
    throw new Error(`Attachment ${attachment.fileName} is missing base64 data`);
  }

  const fileBytes = stringToBytes(base64.decode(attachment.base64Data));
  const boundary = `----FormBoundary${Date.now()}`;
  const body = buildMultipartBody(
    fileBytes,
    attachment.fileName,
    attachment.contentType,
    boundary,
  );

  const uploadResponse = await fetch(DEVIN_ATTACHMENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: body as unknown as BodyInit,
  });

  const bodyText = await uploadResponse.text().catch(() => "");

  if (!uploadResponse.ok) {
    const message = bodyText
      ? `${EXTENSION_NAME} attachment upload failed: ${bodyText}`
      : `${EXTENSION_NAME} attachment upload failed (${uploadResponse.status})`;
    throw new Error(message);
  }

  const trimmed = bodyText.trim();
  if (!trimmed) {
    throw new Error(`${EXTENSION_NAME} attachment upload returned no URL`);
  }

  return trimmed;
}

async function uploadAttachments(
  attachments: RecordAttachment[],
  apiKey: string,
): Promise<string[]> {
  if (!attachments.length) {
    return [];
  }

  const uploads = attachments.map((attachment) =>
    uploadAttachment(attachment, apiKey),
  );

  return Promise.all(uploads);
}

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

  const response = await fetch(DEVIN_SESSIONS_URL, {
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
    const { prompt, title, attachments = [] } = args;

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

    const { playbookId, sessionTags } = settings;
    const tags = parseTags(sessionTags);
    const apiKey = settings.personalApiKey ?? settings.apiKey ?? undefined;

    if (!apiKey) {
      throw new Error(`${EXTENSION_NAME} API key is not configured`);
    }

    const attachmentUrls = await uploadAttachments(attachments, apiKey);
    const attachmentLines = attachmentUrls
      .map((url) => `ATTACHMENT:"${url}"`)
      .join("\n");

    const finalPrompt = attachmentLines
      ? `${prompt.trimEnd()}\n\n${attachmentLines}`
      : prompt;

    const result = await createSession({
      prompt: finalPrompt,
      title,
      tags,
      playbookId,
      apiKey,
    });

    return result;
  },
});
