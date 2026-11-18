import { useEffect, useMemo, useState } from "react";
import { ago, repoSlug, useData, useStored, useStoredSet, visitBaseline, WORKFLOW_FILE } from "./lib";
import { JobsView } from "./JobsView";
import { CompaniesView } from "./CompaniesView";
import { AddCompany } from "./AddCompany";

type Tab = "jobs" | "saved" | "companies" | "add";

export function App() {
  const { data, error, refreshing, refresh } = useData();
  const [tab, setTab] = useStored<Tab>("tab", "jobs");
  const [saved, toggleSaved] = useStoredSet("saved");
  const [hidden, toggleHidden] = useStoredSet("hidden");
  const [theme, setTheme] = useStored<"auto" | "light" | "dark">("theme", "auto");
  const [toast, setToast] = useState<string | null>(null);
  const baseline = useMemo(visitBaseline, []);
  const repo = repoSlug();

  useEffect(() => {
    if (theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  const stats = useMemo(() => {
    if (!data) return null;
    const core = data.jobs.filter((j) => j.tier === "core").length;
    const ok = data.companies.filter((c) => c.status.state === "ok").length;
    return { core, related: data.jobs.length - core, ok, total: data.companies.length };
  }, [data]);

  async function onRefresh() {
    const r = await refresh();
    if (!r) setToast("Couldn't reload the data. Check your connection.");
    else if (!r.changed) setToast("Already showing the latest snapshot. Use “Fetch now” to scan the career sites again.");
    else setToast(`Loaded the latest snapshot — ${r.added} new job${r.added === 1 ? "" : "s"}.`);
    setTimeout(() => setToast(null), 6000);
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect x="2" y="2" width="28" height="28" rx="8" fill="var(--accent)" />
            <path d="M13 7h6M14 7v7l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11.5 19h9" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div>
            <h1>Research Jobs Radar</h1>
            <p className="sub">Lab, research &amp; PhD roles in neuroscience and the life sciences</p>
          </div>
        </div>
        <div className="actions">
          <span className="updated" title={data?.generatedAt}>
            {data ? <>Updated {ago(data.generatedAt)}</> : "Loading…"}
          </span>
          <button className="btn primary" onClick={onRefresh} disabled={refreshing || !data}>
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
          {repo && (
            <a
              className="btn"
              href={`https://github.com/${repo}/actions/workflows/${WORKFLOW_FILE}`}
              target="_blank"
              rel="noreferrer"
              title="Opens GitHub Actions. Click “Run workflow” to scan every career site now (about 30–60 min)."
            >
              Fetch now ↗
            </a>
          )}
          <select
            className="theme"
            aria-label="Theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value as typeof theme)}
          >
            <option value="auto">Auto</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </header>

      {stats && (
        <section className="stats" aria-label="Summary">
          <div><b>{stats.core}</b><span>strong-fit roles</span></div>
          <div><b>{stats.related}</b><span>possible-fit roles</span></div>
          <div><b>{stats.ok}</b><span>employers scanned</span></div>
          <div><b>{stats.total}</b><span>employers listed</span></div>
        </section>
      )}

      <nav className="tabs" role="tablist">
        {(
          [
            ["jobs", "Jobs"],
            ["saved", `Saved${saved.size ? ` (${saved.size})` : ""}`],
            ["companies", "Employers"],
            ["add", "Add employer"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>

      <main>
        {error && !data && <div className="empty">Couldn't load job data: {error}</div>}
        {!data && !error && <div className="empty">Loading jobs…</div>}
        {data && (tab === "jobs" || tab === "saved") && (
          <JobsView
            data={data}
            savedOnly={tab === "saved"}
            saved={saved}
            hidden={hidden}
            toggleSaved={toggleSaved}
            toggleHidden={toggleHidden}
            baseline={baseline}
          />
        )}
        {data && tab === "companies" && <CompaniesView data={data} />}
        {tab === "add" && <AddCompany repo={repo} />}
      </main>

      <footer>
        Listings are read from each employer's public job site and link back to it for applying.
        Some sites can't be read automatically. They are still listed under Employers with a direct link.
      </footer>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
