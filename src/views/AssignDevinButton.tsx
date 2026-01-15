import React, { useState } from "react";
import {
  createDevinSession,
  DevinSessionData,
} from "../events/createDevinSession";
import { buildSessionPrompt } from "../lib/buildSessionPrompt";
import { EXTENSION_ID, SESSION_FIELD } from "../lib/constants";
import { RecordType, isAssignableRecord } from "../lib/records";
import { parseTags } from "../lib/settings";
import { Icon } from "./Icon";

type Status = "idle" | "loading" | "success" | "error" | "existing";

type ViewSettings = {
  customInstructions?: string;
  sessionTags?: string;
  playbookId?: string;
  repository?: string;
  baseBranch?: string;
};

interface AssignDevinButtonProps {
  record: RecordType;
  settings: ViewSettings;
  existingSession?: DevinSessionData;
}

const AssignDevinButton: React.FC<AssignDevinButtonProps> = ({
  record,
  settings,
  existingSession,
}) => {
  console.log("AssignDevinButton settings", JSON.stringify(settings, null, 2));

  const repository = settings.repository?.trim();
  const baseBranch = settings.baseBranch?.trim() || "main";

  const [status, setStatus] = useState<Status>(
    existingSession ? "existing" : "idle"
  );
  const [message, setMessage] = useState<string>(
    existingSession ? "Assigned to Devin." : ""
  );
  const [sessionUrl, setSessionUrl] = useState<string>(
    existingSession?.sessionUrl || ""
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

      const tags = parseTags(settings.sessionTags);
      const playbookId = settings.playbookId || undefined;

      setMessage("Creating Devin session...");

      const session = await createDevinSession({
        recordReference: record.referenceNum,
        recordType: record.typename,
        title,
        prompt,
        repository,
        baseBranch,
        tags,
        playbookId,
      });

      await record.setExtensionField(EXTENSION_ID, SESSION_FIELD, session);

      setStatus("success");
      setMessage("Devin session created.");
      setSessionUrl(session.sessionUrl || "");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setStatus("error");
      setMessage(`Error: ${errorMessage}`);
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

aha.on("assignDevinButton", ({ record, fields }, { settings }) => {
  if (!isAssignableRecord(record)) {
    return (
      <aha-alert type="danger">
        Send to Devin is only available on Features and Requirements.
      </aha-alert>
    );
  }

  const typedRecord = record as RecordType;
  const existing = fields?.[SESSION_FIELD] as DevinSessionData | undefined;

  return (
    <AssignDevinButton
      record={typedRecord}
      settings={settings as ViewSettings}
      existingSession={existing}
    />
  );
});
