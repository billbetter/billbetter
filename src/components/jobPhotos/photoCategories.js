/**
 * What a job photo can be filed under, in display order.
 *
 * `value` is what is stored on the JobPhoto row, so these are data, not
 * labels. The upload form, the edit form and the job's photo filter all read
 * this one list.
 */
export const PHOTO_CATEGORIES = [
  { value: "before", label: "Before" },
  { value: "during", label: "During" },
  { value: "after", label: "After" },
  { value: "issue", label: "Issue" },
  { value: "receipt", label: "Receipt" },
  { value: "other", label: "Other" },
];
