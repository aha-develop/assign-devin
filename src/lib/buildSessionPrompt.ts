export interface RecordAttachment {
  fileName: string;
  contentType: string;
  downloadUrl: string;
}

interface RawAttachment {
  fileName: string;
  contentType: string;
  downloadUrl: string;
}

export interface DevinSessionPayload {
  title: string;
  prompt: string;
  attachments: RecordAttachment[];
  model: FetchedFeature | FetchedRequirement;
}

export interface BuildSessionOptions {
  customInstructions?: string;
  repository: string;
  baseBranch?: string;
}

type NoteWithAttachments = {
  markdownBody?: string;
  attachments?: RecordAttachment[];
};

type FetchedFeature = Aha.Feature & {
  referenceNum: string;
  name: string;
  path: string;
  description?: NoteWithAttachments;
  requirements?: Array<{
    referenceNum: string;
    name?: string;
    description?: { markdownBody?: string };
  }>;
  tasks?: Array<{
    name: string;
    body?: string;
  }>;
};

type FetchedRequirement = Aha.Requirement & {
  referenceNum: string;
  name: string;
  path: string;
  description?: NoteWithAttachments;
  feature?: {
    referenceNum: string;
    name?: string;
    description?: NoteWithAttachments;
  };
  tasks?: Array<{
    name: string;
    body?: string;
  }>;
};

function dedupeAttachments(attachments: RawAttachment[] = []): RawAttachment[] {
  const byUrl = new Map<string, RawAttachment>();
  for (const attachment of attachments) {
    if (!byUrl.has(attachment.downloadUrl)) {
      byUrl.set(attachment.downloadUrl, {
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        downloadUrl: attachment.downloadUrl,
      });
    }
  }

  return Array.from(byUrl.values());
}

export async function describeFeature(id: string) {
  const feature = (await aha.models.Feature.select(
    "id",
    "name",
    "referenceNum",
    "path",
  )
    .merge({
      description: aha.models.Note.select("markdownBody").merge({
        attachments: aha.models.Attachment.select("fileName", "contentType", {
          downloadUrl: { withToken: true },
        }),
      }),
      tasks: aha.models.Task.select("name", "body"),
      requirements: aha.models.Requirement.select("name", "referenceNum"),
    })
    .find(id)) as FetchedFeature | null;

  if (!feature) {
    throw new Error("Failed to load feature details");
  }

  const requirementsBlock = feature.requirements?.length
    ? `### Requirements\n${feature.requirements
        .map(
          (req) =>
            `- **${req.referenceNum}**: ${req.name || "No name provided"}`,
        )
        .join("\n")}`
    : "";

  const todosBlock = feature.tasks?.length
    ? `### Todos\n${feature.tasks
        .map((task) => `- **${task.name}**\n\n${task.body || ""}`)
        .join("\n\n")}`
    : "";

  const context = `### Description\n\n${
    feature.description?.markdownBody || "No description provided."
  }\n\n${requirementsBlock}\n\n${todosBlock}\n\n**Aha! Reference:** [${
    feature.referenceNum
  }](${feature.path})\n`;

  const attachments = dedupeAttachments(feature.description?.attachments);

  return {
    context,
    title: feature.name,
    referenceNum: feature.referenceNum,
    attachments,
    model: feature,
  };
}

export async function describeRequirement(id: string) {
  const requirement = (await aha.models.Requirement.select(
    "id",
    "name",
    "referenceNum",
    "path",
  )
    .merge({
      description: aha.models.Note.select("markdownBody").merge({
        attachments: aha.models.Attachment.select("fileName", "contentType", {
          downloadUrl: { withToken: true },
        }),
      }),
      tasks: aha.models.Task.select("name", "body"),
      feature: aha.models.Feature.select("name", "referenceNum").merge({
        description: aha.models.Note.select("markdownBody").merge({
          attachments: aha.models.Attachment.select("fileName", "contentType", {
            downloadUrl: { withToken: true },
          }),
        }),
      }),
    })
    .find(id)) as FetchedRequirement | null;

  if (!requirement) {
    throw new Error("Failed to load requirement details");
  }

  const todosBlock = requirement.tasks?.length
    ? `### Todos\n${requirement.tasks
        .map((task) => `- **${task.name}**\n\n${task.body || ""}`)
        .join("\n\n")}`
    : "";

  const context = `### Description\n\n${
    requirement.description?.markdownBody || "No description provided."
  }\n\n## Feature ${requirement.feature?.referenceNum}\n\n${
    requirement.feature?.description?.markdownBody ||
    "No feature description provided."
  }\n\n${todosBlock}\n\n**Aha! Reference:** [${requirement.referenceNum}](${
    requirement.path
  })\n`;

  const attachments = dedupeAttachments([
    ...(requirement.description?.attachments || []),
    ...(requirement.feature?.description?.attachments || []),
  ]);

  return {
    context,
    title: requirement.name,
    referenceNum: requirement.referenceNum,
    attachments,
    model: requirement,
  };
}

export async function buildSessionPrompt(
  record: { id: string; typename: "Feature" | "Requirement" },
  options: BuildSessionOptions,
): Promise<DevinSessionPayload> {
  const { customInstructions, repository, baseBranch = "main" } = options;

  const describe =
    record.typename === "Feature"
      ? await describeFeature(record.id)
      : await describeRequirement(record.id);

  const header = `You are being assigned the Aha! ${record.typename.toLowerCase()} ${
    describe.referenceNum
  }: ${describe.title}.`;
  const goal =
    "Review the context and begin executing the work. Share progress updates and include the reference number in relevant branches or pull requests.";

  const repositorySectionLines = [
    `Work in the repository ${repository}.`,
    baseBranch
      ? `Base your work from the ${baseBranch} branch unless instructed otherwise.`
      : undefined,
    `Include ${describe.referenceNum} in branch names and pull request titles.`,
    `Keep commit history and PRs synced to ${repository}.`,
  ].filter(Boolean) as string[];

  const repositorySection = `### Repository\n\n${repositorySectionLines
    .map((line) => `- ${line}`)
    .join("\n")}`;

  let prompt = `${header}\n\n${goal}\n\n${repositorySection}\n\n${describe.context}`;

  if (customInstructions) {
    prompt += `\n### Additional Instructions\n\n${customInstructions}\n`;
  }

  const title = `${describe.referenceNum}: ${describe.title}`;

  return {
    title,
    prompt,
    attachments: describe.attachments,
    model: describe.model,
  };
}
