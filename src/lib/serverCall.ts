import {
  EXTENSION_ID,
  SERVER_POLL_INTERVAL_MS,
  SERVER_TIMEOUT_MS,
} from "./constants";
import { ServerResponse } from "./serverResult";
import { DevinSessionData, DevinSessionRequest } from "./types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls a server event and waits for the response.
 * eventName should a key registered in package.json, i.e. events.createDevinSession
 **/
export async function callServer(
  eventName: "createDevinSession",
  args: DevinSessionRequest
): Promise<DevinSessionData>;
export async function callServer<T>(
  eventName: string,
  args: Record<string, unknown>
): Promise<T>;
export async function callServer<T>(
  eventName: string,
  args: DevinSessionRequest | Record<string, unknown>
): Promise<T> {
  const eventKey = `${eventName}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  // Clear any previous response with the same key
  await aha.account.clearExtensionField(EXTENSION_ID, eventKey).catch(() => {
    /* no-op */
  });

  aha.triggerServer(`${EXTENSION_ID}.${eventName}`, {
    ...args,
    eventKey,
  });

  const timeoutAt = Date.now() + SERVER_TIMEOUT_MS;

  do {
    await delay(SERVER_POLL_INTERVAL_MS);

    const stored = (await aha.account.getExtensionField(
      EXTENSION_ID,
      eventKey
    )) as ServerResponse<T> | null;

    if (stored) {
      await aha.account
        .clearExtensionField(EXTENSION_ID, eventKey)
        .catch(() => {
          /* ignore */
        });

      if (stored.ok) {
        return stored.result;
      }

      const message =
        "message" in stored
          ? stored.message
          : "Server reported an unknown error";
      throw new Error(message);
    }
  } while (Date.now() < timeoutAt);

  throw new Error("Timed out waiting for server response");
}
