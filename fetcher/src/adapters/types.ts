import type { Ats, Company } from "../../../shared/types";

export interface RawJob {
  sourceId: string;
  title: string;
  location?: string;
  url: string;
  posted?: unknown;
  /** Department/description/category text, when the ATS returns it, for field matching. */
  text?: string;
  /** Opaque handle an enricher can use to fetch the full posting (e.g. Workday externalPath). */
  detailRef?: string;
}

export interface AdapterCtx {
  company: Company;
  terms: string[];
  /** Upper bound on postings read per search term (keeps big employers bounded). */
  maxPerTerm: number;
}

export type Adapter<T extends Ats["type"]> = (
  ats: Extract<Ats, { type: T }>,
  ctx: AdapterCtx,
) => Promise<RawJob[]>;

/** Fetches description text for one posting whose list entry had none. */
export type Enricher<T extends Ats["type"]> = (ats: Extract<Ats, { type: T }>, job: RawJob) => Promise<string>;
