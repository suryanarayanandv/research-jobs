import { useMemo, useState } from "react";
import { detectFromUrl } from "../../shared/detect";

import { CATEGORIES, REGIONS } from "../../shared/taxonomy";

/**
 * Builds a companies.json entry. A static site can't write to the repo, so this hands over
 * a JSON snippet to paste into data/companies.json (via GitHub's web editor).
 */
export function AddCompany({ repo }: { repo: string | null }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [region, setRegion] = useState<string>(REGIONS[0]);
  const [hq, setHq] = useState("");
  const [careersUrl, setCareersUrl] = useState("");
  const [jobsUrl, setJobsUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const detected = useMemo(() => {
    try {
      return detectFromUrl(jobsUrl || careersUrl);
    } catch {
      return null;
    }
  }, [jobsUrl, careersUrl]);

  const entry = {
    id: name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name,
    category,
    region,
    hq: hq.toUpperCase(),
    careersUrl,
    ats: detected ?? { type: "link-only", reason: "ATS not detected yet" },
  };
  const json = JSON.stringify(entry, null, 2);
  const ready = name && careersUrl && /^[A-Za-z]{2}$/.test(hq);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json + ",");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the text is selectable below */
    }
  }

  return (
    <div className="add">
      <p className="lead">
        Missing an employer? Fill this in and the site works out which hiring platform it uses from the job-search
        link. Then paste the snippet into <code>data/companies.json</code>. The next scheduled scan picks it up.
      </p>
      <div className="form">
        <label>Company name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tufts University" /></label>
        <label>Type
          <select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label>Region
          <select value={region} onChange={(e) => setRegion(e.target.value)}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
        </label>
        <label>HQ country code<input value={hq} maxLength={2} onChange={(e) => setHq(e.target.value)} placeholder="US" /></label>
        <label className="wide">Careers page URL<input value={careersUrl} onChange={(e) => setCareersUrl(e.target.value)} placeholder="https://www.company.com/careers" /></label>
        <label className="wide">
          Job search URL <small>(the page that actually lists vacancies, if different)</small>
          <input value={jobsUrl} onChange={(e) => setJobsUrl(e.target.value)} placeholder="https://company.wd3.myworkdayjobs.com/en-US/Careers" />
        </label>
      </div>
      <div className={`detect ${detected ? "ok" : ""}`}>
        {detected
          ? `Detected ${detected.type}. It can be scanned automatically.`
          : careersUrl || jobsUrl
            ? "No known hiring platform found in the URL. It'll be added as link-only. Run `npm run detect -- <url>` to inspect the page itself."
            : "Paste a URL to detect the hiring platform."}
      </div>
      <pre className="snippet">{json}</pre>
      <div className="add-actions">
        <button className="btn primary" onClick={copy} disabled={!ready}>{copied ? "Copied ✓" : "Copy JSON"}</button>
        {repo && (
          <a className="btn" href={`https://github.com/${repo}/edit/main/data/companies.json`} target="_blank" rel="noreferrer">
            Open companies.json on GitHub ↗
          </a>
        )}
      </div>
    </div>
  );
}
