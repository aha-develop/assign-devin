import * as z from "zod/mini";
import { RecordAttachment } from "./buildSessionPrompt";
import { DEVIN_API_URL, EXTENSION_NAME } from "./constants";

const DEVIN_SESSIONS_URL = `${DEVIN_API_URL}sessions`;
const DEVIN_ATTACHMENTS_URL = `${DEVIN_API_URL}attachments`;

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

export async function uploadAttachment(
  attachment: RecordAttachment,
  apiKey: string,
): Promise<string> {
  const response = await fetch(attachment.downloadUrl);

  if (!response.ok) {
    console.warn(
      `Failed to fetch attachment ${attachment.fileName}: ${response.status} ${response.statusText}`,
    );
    throw new Error(
      `Failed to fetch attachment ${attachment.fileName}: ${response.status}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);

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

export async function uploadAttachments(
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

export interface DevinSessionData {
  sessionId: string;
  sessionUrl: string;
  assignedAt: string;
}

export async function createSession({
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
  const DevinResponseSchema = z.object({
    session_id: z.string(),
    url: z.string(),
    is_new_session: z.nullable(z.boolean()),
  });

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

  console.log(
    `Creating Devin session with payload: ${JSON.stringify(sessionPayload, null, 2)}`,
  );
  // throw new Error("WIP Testing");

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
