import { buildSessionPrompt } from "../lib/buildSessionPrompt";
import { parseTags } from "../lib/settings";
import { EXTENSION_ID, SESSION_FIELD } from "../lib/constants";
import { isAssignableRecord, RecordType } from "../lib/records";
import {
  createDevinSession,
  DevinSessionData,
} from "../events/createDevinSession";

const FIELD_DESCRIPTION = "Devin session";

aha.on("assignDevin", async ({ record }, { settings }) => {
  if (!isAssignableRecord(record)) {
    aha.commandOutput(
      "Error: Please run this command on a Feature or Requirement"
    );
    return;
  }

  const typedRecord = record as RecordType;

  try {
    const existing = (await typedRecord.getExtensionField(
      EXTENSION_ID,
      SESSION_FIELD
    )) as DevinSessionData | null;

    if (existing) {
      aha.commandOutput(
        `Already assigned to Devin: ${
          existing.sessionUrl || existing.sessionId
        }`
      );
      return;
    }

    const repository = (settings.repository as string | undefined)?.trim();
    if (!repository || !repository.includes("/")) {
      aha.commandOutput(
        "Error: Please configure the repository setting (e.g., owner/repo)"
      );
      return;
    }

    const baseBranch =
      (settings.baseBranch as string | undefined)?.trim() || "main";

    aha.commandOutput("Building context...");

    const customInstructions = settings.customInstructions as
      | string
      | undefined;
    const { title, prompt } = await buildSessionPrompt(typedRecord, {
      customInstructions,
      repository,
      baseBranch,
    });

    const tagsSetting = settings.sessionTags as string | undefined;
    const tags = parseTags(tagsSetting);
    const playbookId = (settings.playbookId as string | undefined) || undefined;

    aha.commandOutput("Requesting Devin session...");

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

    await typedRecord.setExtensionField(EXTENSION_ID, SESSION_FIELD, session);

    aha.commandOutput(
      `✓ ${FIELD_DESCRIPTION} created: ${
        session.sessionUrl || session.sessionId
      }`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    aha.commandOutput(`Error: ${message}`);
  }
});
