export type FeatureRecord = Pick<
  Aha.Feature,
  "typename" | "id" | "referenceNum" | "setExtensionField" | "getExtensionField"
> & {
  typename: "Feature";
};

export type RequirementRecord = Pick<
  Aha.Requirement,
  "typename" | "id" | "referenceNum" | "setExtensionField" | "getExtensionField"
> & {
  typename: "Requirement";
};

export type RecordType = FeatureRecord | RequirementRecord;

export function isAssignableRecord(record: unknown): record is RecordType {
  return (
    !!record &&
    (record as { typename?: string }).typename !== undefined &&
    (["Feature", "Requirement"] as string[]).includes(
      (record as { typename: string }).typename,
    ) &&
    typeof (record as FeatureRecord).referenceNum === "string"
  );
}
