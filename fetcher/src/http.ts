// Polite HTTP: one request at a time per host with a minimum gap, timeouts, retries,
// and a robots.txt check for page-scraping adapters.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/130.0 Safari/537.36 ResearchJobsRadar/1.0 (personal job-search aggregator)";

const MIN_GAP_MS = Number(process.env.MIN_GAP_MS ?? 800);
const TIMEOUT_MS = 40_000; // some Oracle tenants take 10–20 s

const hostQueues = new Map<string, Promise<unknown>>();

// Multi-tenant ATS platforms rate-limit per client across all their tenants, so every
// tenant host on one of these shares a single queue (and a shorter gap than MIN_GAP_MS).
const SHARED_PLATFORMS: [RegExp, string, number][] = [
  [/\.myworkday(jobs|site)\.com$/, "workday", 600],
  [/\.oraclecloud\.com$/, "oracle", 450],
  [/(^|\.)(successfactors\.(com|eu)|sapsf\.(com|eu)|hr\.cloud\.sap)$/, "sap", 450],
  [/(^|\.)eightfold\.ai$/, "eightfold", 450],
];

function queueFor(host: string): [key: string, gap: number] {
  for (const [re, key, gap] of SHARED_PLATFORMS) if (re.test(host)) return [key, gap];
  return [host, MIN_GAP_MS];
}

function throttled<T>(host: string, fn: () => Promise<T>): Promise<T> {
  const [key, gap] = queueFor(host);
  const prev = hostQueues.get(key) ?? Promise.resolve();
  const run = () => fn().finally(() => new Promise((r) => setTimeout(r, gap)));
  const next = prev.then(run, run);
  hostQueues.set(key, next.catch(() => {}));
  return next;
}

// A platform that answered with a bot-protection challenge: we don't try to get past it,
// and we stop sending it requests for the rest of the run.
const challenged = new Set<string>();

export class BlockedError extends Error {}

export class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
  }
}

export interface RequestOpts {
  method?: "GET" | "POST";
  json?: unknown;
  headers?: Record<string, string>;
  /** Check robots.txt first (for HTML scraping, not documented public APIs). */
  robots?: boolean;
  retries?: number;
}

async function raw(url: string, opts: RequestOpts): Promise<Response> {
  const u = new URL(url);
  if (opts.robots && !(await robotsAllowed(u))) {
    throw new Error(`robots.txt disallows ${u.pathname}`);
  }
  const [platform] = queueFor(u.host);
  const blocked = () => new BlockedError(`blocked by bot protection (Cloudflare challenge) at ${u.host}`);
  if (challenged.has(platform)) throw blocked();
  const retries = opts.retries ?? 3;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await throttled(u.host, () =>
        fetch(url, {
          method: opts.method ?? (opts.json ? "POST" : "GET"),
          headers: {
            "User-Agent": UA,
            "Accept-Language": "en-US,en;q=0.9",
            Accept: opts.json ? "application/json" : "text/html,application/json;q=0.9,*/*;q=0.8",
            ...(opts.json ? { "Content-Type": "application/json" } : {}),
            ...opts.headers,
          },
          body: opts.json ? JSON.stringify(opts.json) : undefined,
          redirect: "follow",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }),
      );
      if (res.ok) return res;
      // Cloudflare reports its bot check as a 429 too; unlike a real rate limit it won't clear by retrying.
      if (res.headers.get("cf-mitigated") === "challenge") {
        challenged.add(platform);
        throw blocked();
      }
      // 4xx other than 429 won't get better by retrying.
      if (res.status !== 429 && res.status < 500) throw new HttpError(res.status, url);
      lastErr = new HttpError(res.status, url);
      if (res.status === 429) {
        // Rate limited: wait as told (or back off hard) inside the platform's queue, so every
        // other request to that platform waits too instead of piling on.
        const wait = Math.min(Number(res.headers.get("retry-after")) * 1000 || 10_000 * (attempt + 1), 60_000);
        await throttled(u.host, () => new Promise((r) => setTimeout(r, wait)));
        continue;
      }
    } catch (e) {
      if (e instanceof BlockedError || (e instanceof HttpError && e.status !== 429 && e.status < 500)) throw e;
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw lastErr;
}

export async function getJson<T = any>(url: string, opts: RequestOpts = {}): Promise<T> {
  const res = await raw(url, { ...opts, headers: { Accept: "application/json", ...opts.headers } });
  const body = await res.json();
  // Some ASP.NET endpoints double-encode: the JSON body is itself a JSON string.
  if (typeof body === "string" && /^\s*[[{]/.test(body)) return JSON.parse(body) as T;
  return body as T;
}

const memo = new Map<string, Promise<string>>();

/** `memo: true` reuses the response for identical URLs within this run. */
export async function getText(url: string, opts: RequestOpts & { memo?: boolean } = {}): Promise<string> {
  if (opts.memo) {
    if (!memo.has(url)) memo.set(url, getText(url, { ...opts, memo: false }));
    return memo.get(url)!;
  }
  const res = await raw(url, opts);
  return res.text();
}

// --- robots.txt (minimal: User-agent * groups, longest-match Allow/Disallow) ---

const robotsCache = new Map<string, Promise<{ allow: string[]; disallow: string[] }>>();

async function loadRobots(origin: string) {
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { allow: [], disallow: [] };
    return parseRobots(await res.text());
  } catch {
    return { allow: [], disallow: [] };
  }
}

export function parseRobots(txt: string) {
  const allow: string[] = [];
  const disallow: string[] = [];
  let applies = false;
  let lastWasAgent = false;
  for (const line of txt.split(/\r?\n/)) {
    const m = line.replace(/#.*/, "").trim().match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!lastWasAgent) applies = false;
      if (val === "*") applies = true;
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!applies) continue;
    if (key === "allow" && val) allow.push(val);
    if (key === "disallow" && val) disallow.push(val);
  }
  return { allow, disallow };
}

function ruleMatches(rule: string, path: string) {
  const re = new RegExp(
    "^" + rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"),
  );
  return re.test(path);
}

export function isAllowed(rules: { allow: string[]; disallow: string[] }, path: string) {
  const best = (list: string[]) =>
    list.filter((r) => ruleMatches(r, path)).reduce((n, r) => Math.max(n, r.length), -1);
  return best(rules.allow) >= best(rules.disallow);
}

async function robotsAllowed(u: URL) {
  if (!robotsCache.has(u.origin)) robotsCache.set(u.origin, loadRobots(u.origin));
  return isAllowed(await robotsCache.get(u.origin)!, u.pathname + u.search);
}
