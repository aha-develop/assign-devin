import React, { useState } from "react";
import {
  createDevinSession,
  DevinSessionData,
  DevinSessionDataSchema,
} from "../events/createDevinSession";
import { buildSessionPrompt } from "../lib/buildSessionPrompt";
import { EXTENSION_ID, EXTENSION_NAME, SESSION_FIELD } from "../lib/constants";
import { isAssignableRecord, RecordType } from "../lib/records";
import { ExtensionSettings, ExtensionSettingsSchema } from "../lib/settings";
import { Icon } from "./Icon";

type Status = "idle" | "loading" | "success" | "error" | "existing";

interface SendToDevinButtonProps {
  record: RecordType;
  settings: ExtensionSettings;
  existingSession?: DevinSessionData;
}

const SendToDevinButton: React.FC<SendToDevinButtonProps> = ({
  record,
  settings,
  existingSession,
}) => {
  const repository = settings.repository?.trim();
  const baseBranch = settings.baseBranch?.trim() || "main";

  const [status, setStatus] = useState<Status>(
    existingSession ? "existing" : "idle",
  );
  const [message, setMessage] = useState<string>(
    existingSession ? "Sent to Devin." : "",
  );
  const [sessionUrl, setSessionUrl] = useState<string>(
    existingSession?.sessionUrl || "",
  );

  if (!repository || !repository.includes("/")) {
    return (
      <aha-alert type="warning">
        Configure the repository setting (e.g., owner/repo) to assign Devin.
      </aha-alert>
    );
  }

  const handleClick = async () => {
    setStatus("loading");
    setMessage("Gathering context...");

    try {
      const { title, prompt } = await buildSessionPrompt(record, {
        customInstructions: settings.customInstructions,
        repository,
        baseBranch,
      });

      setMessage(`Creating ${EXTENSION_NAME} session...`);

      const session = await createDevinSession({
        title,
        prompt,
      });

      await record.setExtensionField(EXTENSION_ID, SESSION_FIELD, session);

      setStatus("success");
      setMessage(`${EXTENSION_NAME} session created.`);
      setSessionUrl(session.sessionUrl || "");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setStatus("error");
      setMessage(errorMessage);
    }
  };

  return (
    <div style={{ padding: "8px 0" }}>
      {status === "idle" && (
        <aha-button kind="secondary" size="small" onClick={handleClick}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginTop: "4px",
            }}
          >
            <Icon /> Send to Devin
          </span>
        </aha-button>
      )}

      {status === "loading" && (
        <aha-alert type="info">
          <aha-spinner slot="icon" /> {message}
        </aha-alert>
      )}

      {(status === "success" || status === "existing") && (
        <aha-alert type={status === "success" ? "success" : "info"}>
          {message}{" "}
          {sessionUrl && (
            <a href={sessionUrl} target="_blank" rel="noopener noreferrer">
              View session
            </a>
          )}
        </aha-alert>
      )}

      {status === "error" && (
        <aha-alert type="danger">
          {message || "An unexpected error occurred."}{" "}
          <aha-button
            size="small"
            kind="secondary"
            onClick={() => {
              setStatus(existingSession ? "existing" : "idle");
              setMessage(existingSession ? "Assigned to Devin." : "");
            }}
          >
            Try again
          </aha-button>
        </aha-alert>
      )}
    </div>
  );
};

aha.on("sendToDevinButton", ({ record, fields }, { settings: rawSettings }) => {
  if (!isAssignableRecord(record)) {
    return (
      <aha-alert type="danger">
        Send to Devin is only available on Features and Requirements.
      </aha-alert>
    );
  }

  const parsedSettings = ExtensionSettingsSchema.safeParse(rawSettings);
  if (!parsedSettings.success) {
    console.error(
      `Invalid extension settings: ${parsedSettings.error.message}`,
    );
    return (
      <aha-alert type="danger">
        Please ensure required{" "}
        <a href="/develop/settings/account/extensions">
          {EXTENSION_NAME} settings
        </a>{" "}
        are configured.
      </aha-alert>
    );
  }

  const rawField = fields?.[SESSION_FIELD];
  const recordSession = DevinSessionDataSchema.safeParse(rawField);
  const existingSession = recordSession.success
    ? recordSession.data
    : undefined;

  const settings = parsedSettings.data;

  const typedRecord = record as RecordType;

  return (
    <SendToDevinButton
      record={typedRecord}
      settings={settings}
      existingSession={existingSession}
    />
  );
});
