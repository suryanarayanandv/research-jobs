# Research Jobs Radar

One place to see early-career **life-science research** vacancies (research technician/assistant, lab
technician, industry research associate / scientist I / analyst, PhD & pre-doc positions, and India's JRF /
project positions) from university, research-institute, hospital and pharma/biotech job sites across the
**US, UK, Europe and India**, with a focus on neuroscience and molecular/cell biology.

Built on the same engine as the oil & gas Safety Jobs Radar.

- **Website**: a static site (GitHub Pages). It reads `web/public/data/jobs.json` and `directory.json`.
- **Fetcher**: a Node script that runs in GitHub Actions every 8 hours. It reads each employer's job site
  through an adapter for its hiring platform and writes those JSON files.

Browsers block a page from reading other sites' job data (CORS), which is why fetching runs in Actions and not
in the browser. Nothing needs hosting or maintenance; GitHub runs both parts for free.

```
data/companies.json ──► fetcher (adapter per ATS) ──► web/public/data/*.json ──► static site
```

## Deploy (one time, ~5 minutes)

1. Create a GitHub repo and push this folder to `main`.
2. In the repo, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Go to **Actions → "Fetch jobs and deploy" → Run workflow**. The first scan takes about 30–60 minutes.
4. The site is at `https://<user>.github.io/<repo>/`.

Updates after that:
- **Automatic**: the workflow runs every 8 hours and commits the new snapshot.
- **On demand**: the site's **Fetch now ↗** button opens the workflow page; click **Run workflow**.
  Then press **↻ Refresh** on the site to load the new snapshot.
- Pushing code redeploys the site without re-scanning. Put `[fetch]` in the commit message to also re-scan.

## Run locally

```bash
npm install
npm run build:companies     # merge data/research/*.json + data/overrides.json -> data/companies.json
npm run fetch               # scan everything (or: npm run fetch -- --only shell,adnoc-offshore)
npm run dev                 # http://localhost:5173
npm test                    # fetcher unit tests
```

## Adding or fixing an employer

The employer list is researched per region/segment in `data/research/*.json` (see `data/SCHEMA.md` for the format).
Hand corrections go in `data/overrides.json`, keyed by employer id, and win over the researched values.

```bash
npm run detect -w fetcher -- https://careers.example.com     # guess the ATS + config from a URL
npm run probe  -w fetcher -- <company-id> [term]              # run one employer's adapter, print raw postings
```

The site's **Add employer** tab builds the JSON entry for you.

## Supported hiring platforms

| `ats.type` | Platform | Method |
|---|---|---|
| `workday` | Workday | public CXS JSON search |
| `oracle` | Oracle Recruiting Cloud | public REST finder |
| `successfactors` | SAP SuccessFactors Career Site Builder | search page HTML, or the "Unify" JSON API |
| `successfactors-classic` | legacy SuccessFactors portal | XML job feed |
| `phenom` | Phenom People | inline `phApp.ddo` JSON on the search page |
| `avature` | Avature | search page HTML |
| `eightfold` | Eightfold | v2 or PCSX JSON API |
| `smartrecruiters`, `greenhouse`, `lever` | public posting APIs | JSON |
| `icims`, `taleo` | iCIMS, Taleo | best effort |
| `html` | anything else | JSON-LD `JobPosting`, or job links matched by `linkPattern` |
| `link-only` | can't be automated | listed with a direct careers link |

## Matching

`data/keywords.json` decides what's kept and how it's labelled:

- **Role type**, from the title: *Lab technician / assistant*, *Industry lab role*, *PhD / pre-doc*,
  or *JRF / project position*. "Research Associate" counts as an industry role at pharma/biotech/CRO
  employers and a lab role elsewhere.
- **Field fit**, from the title plus the department/description where the platform provides it.
  Neuroscience, behaviour, molecular/cell biology, model organisms and lab techniques score highest.
  Workday lists have no descriptions, so the fetcher reads the full posting for role-matching titles
  (up to `MAX_ENRICH`, default 40, per employer).
  - **Strong fit**: a clear field match.
  - **Possible fit**: a lab role with little field evidence (often just a bare "Research Technician" title).
- **Dropped**: postdoc/faculty/senior roles, clinical and facilities jobs, and research jobs in unrelated
  fields (e.g. "Research Assistant – Economics").

## Being a good citizen

- Only public job listings are read, at most one request per ~0.8 s per host, a few times a day.
  `robots.txt` is honoured for page scraping.
- Every job links to the employer's own site to apply.
- LinkedIn, Indeed, Nature Careers, FindAPhD and similar boards are offered as one-click searches
  instead of being scraped.
- Some employers' sites block automated requests from cloud servers. Those show as **Fetch failed** or
  **Link only** under Employers; the previous snapshot of an errored employer's jobs is kept for 7 days.
- When a site answers with a bot-protection challenge (Cloudflare `cf-mitigated: challenge`, currently
  the case for all Workday career sites), the fetcher does not try to get past it: that platform is
  skipped for the rest of the run and its employers show "blocked by bot protection".
- Ctrl-C during `npm run fetch` saves what has been fetched so far.
