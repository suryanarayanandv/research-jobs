import keywords from "../../data/keywords.json" with { type: "json" };
import type { Category, Role } from "../../shared/types";
import { INDUSTRY } from "../../shared/taxonomy";

const re = (s: string) => new RegExp(s, "i");
const roles = keywords.roles.map((r) => ({ id: r.id as Role, re: re(r.re) }));
const fields = keywords.fields.map((f) => ({ re: new RegExp(f.re, "gi"), w: f.w }));
const exclude = keywords.exclude.map(re);
const offField = keywords.offField.map(re);

export const searchTerms: string[] = keywords.searchTerms;

export interface Classification {
  score: number;
  tier: "core" | "related" | null;
  role: Role | null;
  matched: string[];
}

const RESEARCHY = /research|\blab|laborator|scien|ph\.?\s?d|doctoral|studentship|fellow|project|biolog|\bJRF\b|\bSRF\b/i;

const DROP: Classification = { score: 0, tier: null, role: null, matched: [] };

/**
 * Role comes from the title; field relevance from the title (counted double) and, when the
 * ATS provides it, the department/description text.
 */
export function classify(title: string, text = "", category?: Category, location = ""): Classification {
  if (exclude.some((e) => e.test(title))) return DROP;
  let role = roles.find((r) => r.re.test(title))?.id ?? null;
  if (!role) return DROP;
  // Lab roles are "industry" exactly when the employer is pharma/biotech/CRO: a university's
  // "Research Scientist 1" or "Research Associate" is an academic staff lab role.
  if (category && (role === "industry" || role === "tech"))
    role = INDUSTRY.includes(category) ? "industry" : "tech";

  let score = 0;
  const matched = new Set<string>();
  for (const f of fields) {
    const inTitle = title.match(f.re) ?? [];
    const inText = text.match(f.re) ?? [];
    // Description text can repeat a term dozens of times; count distinct terms only.
    const distinct = new Set([...inTitle, ...inText].map((m) => m.toLowerCase()));
    if (!distinct.size) continue;
    score += f.w * (inTitle.length ? 2 : 1) * Math.min(distinct.size, 3);
    for (const d of distinct) if (matched.size < 6) matched.add(d);
  }
  if (score === 0 && offField.some((o) => o.test(`${title} ${text}`))) return DROP;
  // Some university ATSs put the department where the location goes ("Department of Physics"):
  // an off-field department wins over description words unless the title itself is on-field.
  if (/department|school|faculty|institute|centre|center/i.test(location) && offField.some((o) => o.test(location)) &&
      !fields.some((f) => title.match(f.re))) return DROP;
  // With no field evidence at all, only keep titles that are explicitly research/lab roles,
  // so a bare "Technician" or "Scientist" elsewhere in a university or company doesn't slip in.
  if (score === 0 && !RESEARCHY.test(title)) return DROP;
  return { score, tier: score >= keywords.coreScore ? "core" : "related", role, matched: [...matched] };
}
