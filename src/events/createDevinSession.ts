import * as z from "zod/mini";
import { buildSessionPrompt } from "../lib/buildSessionPrompt";
import { EXTENSION_ID, EXTENSION_NAME, SESSION_FIELD } from "../lib/constants";
import type { DevinSessionData } from "../lib/devin";
import { createSession, uploadAttachments } from "../lib/devin";
import { callEventHandler, registerEventHandler } from "../lib/events";
import { ExtensionSettingsSchema, parseTags } from "../lib/settings";

const CreateSessionSchema = z.object({
  record: z.object({
    typename: z.enum(["Feature", "Requirement"]),
    id: z.string(),
  }),
});

export const DevinSessionDataSchema = z.object({
  sessionId: z.string(),
  sessionUrl: z.string(),
  assignedAt: z.string(),
});

export type DevinSessionData = z.infer<typeof DevinSessionDataSchema>;

export type CreateSession = z.infer<typeof CreateSessionSchema>;

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
    const { record } = args;

    console.log(
      `Received createDevinSession event for record ${record.typename} with ID ${record.id}`,
    );

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

    const repository = settings.repository?.trim();
    const baseBranch = settings.baseBranch?.trim() || "main";

    const { title, prompt, attachments, model } = await buildSessionPrompt(
      record,
      {
        repository,
        baseBranch,
        customInstructions: settings.customInstructions,
      },
    );

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

    await model.setExtensionField(EXTENSION_ID, SESSION_FIELD, result);

    return result;
  },
});
