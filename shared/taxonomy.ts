// The research stream's employer categories, regions and role types, shared by the
// fetcher's validator and the web app's filters/forms.

export const CATEGORIES = [
  "University", "Medical School / Hospital", "Research Institute", "Government Lab",
  "Pharma", "Biotech", "CRO / CDMO", "Job Feed",
] as const;

export const REGIONS = ["United States", "United Kingdom", "Europe", "India", "Other"] as const;

export const ROLES = {
  tech: "Lab technician / assistant",
  industry: "Industry lab role",
  phd: "PhD / pre-doc",
  project: "JRF / project position",
} as const;

export type Category = (typeof CATEGORIES)[number];
export type Region = (typeof REGIONS)[number];
export type Role = keyof typeof ROLES;

export const INDUSTRY: readonly Category[] = ["Pharma", "Biotech", "CRO / CDMO"];
