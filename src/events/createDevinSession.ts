import { EXTENSION_ID, SESSION_FIELD } from "../lib/constants";
import { DevinSessionData, DevinSessionRequest } from "../lib/types";
import {
  ServerResponse,
  ServerSuccess,
  ServerError,
} from "../lib/serverResult";
import { parseTags } from "../lib/settings";

const DEVIN_API_URL = "https://api.devin.ai/v1/sessions";

interface CreateDevinSessionArgs extends DevinSessionRequest {
  eventKey: string;
}

// callServer @see src/lib/serverCall.ts will check this field
async function writeResult<T>(
  eventKey: string,
  payload: ServerResponse<T>
): Promise<void> {
  await aha.account.setExtensionField(EXTENSION_ID, eventKey, payload);
}

function buildError(message: string): ServerError {
  return { ok: false, message };
}

function buildSuccess(
  result: DevinSessionData
): ServerSuccess<DevinSessionData> {
  return { ok: true, result };
}

aha.on(
  { event: `${EXTENSION_ID}.createDevinSession` },
  async (args: CreateDevinSessionArgs, { settings }) => {
    const {
      eventKey,
      prompt,
      title,
      tags,
      playbookId,
      repository,
      baseBranch,
    } = args;

    if (!eventKey) {
      console.error("createDevinSession called without eventKey");
      return;
    }

    if (!repository) {
      await writeResult(eventKey, buildError("Repository was not provided"));
      return;
    }

    const token = settings.devinApiToken as string | undefined;
    if (!token) {
      await writeResult(
        eventKey,
        buildError("Devin API token is not configured")
      );
      return;
    }

    console.log("Creating Devin session", {
      recordReference: args.recordReference,
      recordType: args.recordType,
      title,
      repository,
      baseBranch,
    });

    const defaultTags = parseTags(settings.sessionTags as string | undefined);
    const effectiveTags = tags && tags.length ? tags : defaultTags;
    const effectivePlaybookId =
      playbookId || (settings.playbookId as string | undefined) || undefined;

    const sessionPayload: Record<string, unknown> = {
      prompt,
      idempotent: true,
    };

    if (title) {
      sessionPayload.title = title;
    }
    if (effectiveTags && effectiveTags.length) {
      sessionPayload.tags = effectiveTags;
    }
    if (effectivePlaybookId) {
      sessionPayload.playbook_id = effectivePlaybookId;
    }

    try {
      const response = await fetch(DEVIN_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionPayload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof data === "object" && data && "message" in data
            ? String((data as { message: unknown }).message)
            : `Devin API error (${response.status})`;
        await writeResult(eventKey, buildError(message));
        return;
      }

      const session: DevinSessionData = {
        sessionId: String((data as any).session_id),
        sessionUrl: String((data as any).url),
        assignedAt: new Date().toISOString(),
        title,
        prompt,
        repository,
        baseBranch,
        tags: effectiveTags,
        playbookId: effectivePlaybookId,
      };

      await writeResult(eventKey, buildSuccess(session));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? "Unknown error");
      await writeResult(eventKey, buildError(message));
    }
  }
);
