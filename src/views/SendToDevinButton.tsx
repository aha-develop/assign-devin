import React, { useState } from "react";
import {
  createDevinSession,
  DevinSessionData,
  DevinSessionDataSchema,
} from "../events/createDevinSession";
import { buildSessionPrompt } from "../lib/buildSessionPrompt";
import { EXTENSION_ID, SESSION_FIELD } from "../lib/constants";
import { isAssignableRecord, RecordType } from "../lib/records";
import { ExtensionSettings, ExtensionSettingsSchema } from "../lib/settings";
import { Icon } from "./Icon";
import { SendToAI } from "./SendToAI";

type Status =
  | "not-configured"
  | "idle"
  | "loading"
  | "success"
  | "error"
  | "existing";

interface SendToDevinButtonProps {
  record: RecordType;
  settings?: ExtensionSettings;
  existingSession?: DevinSessionData;
}

const SendToDevinButton: React.FC<SendToDevinButtonProps> = ({
  record,
  settings,
  existingSession,
}) => {
  const [status, setStatus] = useState<Status>(
    !settings ? "not-configured" : existingSession ? "existing" : "idle",
  );
  const [message, setMessage] = useState<string>(
    existingSession ? "Sent to Devin." : "",
  );
  const [sessionUrl, setSessionUrl] = useState<string>(
    existingSession?.sessionUrl || "",
  );

  const handleClick = async () => {
    const repository = settings.repository?.trim();
    const baseBranch = settings.baseBranch?.trim() || "main";

    setStatus("loading");
    setMessage("Gathering context...");

    try {
      const { title, prompt } = await buildSessionPrompt(record, {
        customInstructions: settings.customInstructions,
        repository,
        baseBranch,
      });

      setMessage(`Creating Devin session...`);

      const session = await createDevinSession({
        title,
        prompt,
      });

      await record.setExtensionField(EXTENSION_ID, SESSION_FIELD, session);

      setStatus("success");
      setMessage(
        `Success. Devin has started work on this ${record.typename.toLowerCase()}.`,
      );
      setSessionUrl(session.sessionUrl || "");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setStatus("error");
      setMessage(errorMessage);
    }
  };

  return (
    <>
      {(status === "idle" ||
        status === "error" ||
        status === "not-configured") && (
        <SendToAI
          label="Build with Devin"
          icon={<Icon />}
          button={
            status === "not-configured" ? (
              <aha-button
                kind="secondary"
                size="small"
                onClick={(e) => {
                  e.preventDefault();
                  window.open("/develop/settings/account/extensions");
                }}
              >
                Configure Devin <i className="fa-regular fa-gear"></i>
              </aha-button>
            ) : (
              <aha-button kind="secondary" size="small" onClick={handleClick}>
                Send to Devin <i className="fa-regular fa-arrow-right"></i>
              </aha-button>
            )
          }
          footer={`Share this ${record.typename.toLowerCase()} with Devin to begin implementation.`}
          alert={
            status === "error" ? (
              <aha-alert type="danger" size="mini">
                {message || "An unexpected error occurred."}
              </aha-alert>
            ) : null
          }
        />
      )}

      {status === "loading" && (
        <SendToAI
          label="Sending to Devin..."
          icon={<Icon />}
          button={
            <aha-button
              kind="secondary"
              size="small"
              onClick={(e) => {
                e.preventDefault();
              }}
            >
              <span>
                Creating session
                <aha-spinner style={{ marginLeft: "6px" }} size="10px" />
              </span>
            </aha-button>
          }
          footer={message}
        />
      )}

      {(status === "success" || status === "existing") && (
        <>
          <SendToAI
            label="Assigned to Devin"
            icon={<Icon />}
            button={
              <aha-button
                kind="secondary"
                size="small"
                onClick={(e) => {
                  e.preventDefault();
                  window.open(sessionUrl, "_blank", "noopener noreferrer");
                }}
              >
                View session
                <i className="fa-regular fa-arrow-up-right" />
              </aha-button>
            }
            alert={
              status === "success" ? (
                <aha-alert type="success" size="mini">
                  {message}
                </aha-alert>
              ) : null
            }
          />
        </>
      )}
    </>
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

  const rawField = fields?.[SESSION_FIELD];
  const recordSession = DevinSessionDataSchema.safeParse(rawField);
  const existingSession = recordSession.success
    ? recordSession.data
    : undefined;

  const parsedSettings = ExtensionSettingsSchema.safeParse(rawSettings);
  const settings = parsedSettings.success ? parsedSettings.data : undefined;

  const typedRecord = record as RecordType;

  return (
    <SendToDevinButton
      record={typedRecord}
      settings={settings}
      existingSession={existingSession}
    />
  );
});
