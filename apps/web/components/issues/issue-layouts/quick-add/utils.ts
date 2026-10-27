import type { TIssue } from "@plane/types";

export const getSectionQuickAddData = (sectionId: string): Pick<TIssue, "section_id"> => ({
  section_id: sectionId === "None" ? null : sectionId,
});
