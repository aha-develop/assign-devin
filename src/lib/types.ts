import { RecordType } from "./records";

export interface DevinSessionData {
  sessionId: string;
  sessionUrl: string;
  assignedAt: string;
  title: string;
  prompt: string;
  repository: string;
  baseBranch?: string;
  tags?: string[];
  playbookId?: string;
}

export interface DevinSessionRequest {
  recordReference: string;
  recordType: RecordType["typename"];
  title: string;
  prompt: string;
  repository: string;
  baseBranch?: string;
  tags?: string[];
  playbookId?: string;
}
