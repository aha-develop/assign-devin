import { z } from "zod";

interface ServerSuccess<T> {
  ok: true;
  result: T;
}

interface ServerError {
  ok: false;
  message: string;
}

type ServerResponse<T> = ServerSuccess<T> | ServerError;

/**
 * Base schema that all event handlers must include.
 * Provides the eventKey used for result storage.
 */
const baseEventSchema = z.object({
  eventKey: z.string(),
});

/**
 * Schema for validating server responses stored in extension fields.
 */
const serverResponseSchema = <T extends z.ZodType>(resultSchema: T) =>
  z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), result: resultSchema }),
    z.object({ ok: z.literal(false), message: z.string() }),
  ]);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateEventKey(eventName: string): string {
  return `${eventName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function writeResult<T>({
  extensionId,
  eventKey,
  payload,
}: {
  extensionId: string;
  eventKey: string;
  payload: ServerResponse<T>;
}): Promise<void> {
  await aha.account.setExtensionField(extensionId, eventKey, payload);
}

function storeError(message: string): ServerError {
  return { ok: false, message };
}

function storeSuccess<T>(result: T): ServerSuccess<T> {
  return { ok: true, result };
}

type CallServerOptions = {
  pollInterval?: number;
  timeoutMs?: number;
};

const DEFAULT_POLL_INTERVAL = 500;
const DEFAULT_TIMEOUT_MS = 60000;

export async function callEventHandler<T>({
  extensionId,
  eventName,
  args,
  resultSchema = z.unknown() as z.ZodType<T>,
  options = {},
}: {
  extensionId: string;
  eventName: string;
  args: Record<string, unknown>;
  resultSchema?: z.ZodType<T>;
  options?: CallServerOptions;
}): Promise<T> {
  const {
    pollInterval = DEFAULT_POLL_INTERVAL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const eventKey = generateEventKey(eventName);
  const responseSchema = serverResponseSchema(resultSchema);

  // Clear any previous response with the same key
  await aha.account.clearExtensionField(extensionId, eventKey).catch(() => {
    /* no-op */
  });

  // Trigger the server event with args + eventKey
  aha.triggerServer(`${extensionId}.${eventName}`, {
    ...args,
    eventKey,
  });

  const timeoutAt = Date.now() + timeoutMs;

  // Poll for result
  do {
    await delay(pollInterval);

    const raw = await aha.account.getExtensionField(extensionId, eventKey);

    if (raw != null) {
      // Clean up the stored result
      await aha.account.clearExtensionField(extensionId, eventKey).catch(() => {
        /* ignore */
      });

      const parsed = responseSchema.safeParse(raw);

      if (!parsed.success) {
        throw new Error(`Invalid server response: ${parsed.error.message}`);
      }

      const response = parsed.data;
      if (response.ok === false) {
        throw new Error(response.message);
      }

      return response.result;
    }
  } while (Date.now() < timeoutAt);

  throw new Error(`Timed out waiting for ${eventName} response`);
}

export function registerEventHandler<TSchema extends z.ZodType, TResult>({
  extensionId,
  eventName,
  schema,
  handler,
}: {
  extensionId: string;
  eventName: string;
  schema: TSchema;
  handler: (args: z.infer<TSchema>, context: Aha.Context) => Promise<TResult>;
}) {
  aha.on({ event: `${extensionId}.${eventName}` }, async (args, context) => {
    const eventKeyResult = baseEventSchema.safeParse(args);
    if (!eventKeyResult.success) {
      console.error(
        `Missing or invalid eventKey in arguments for ${extensionId}.${eventName}`
      );
      return;
    }
    const eventKey = eventKeyResult.data.eventKey;
    const parsed = schema.safeParse(args);

    if (!parsed.success) {
      await writeResult({
        extensionId,
        eventKey,
        payload: storeError(
          "Invalid arguments passed to event handler: " + parsed.error.message
        ),
      });

      return;
    }

    try {
      const result = await handler(parsed.data, context);
      await writeResult({
        extensionId,
        eventKey,
        payload: storeSuccess(result),
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? "Unknown error");
      await writeResult({
        extensionId,
        eventKey,
        payload: storeError(message),
      });
    }
  });
}
