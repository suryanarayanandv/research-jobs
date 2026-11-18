// Smaller ATSs with public JSON endpoints, mostly used by service companies.
import { getJson, getText } from "../http";
import { extractJsonAfter } from "./html-sites";
import type { Adapter, RawJob } from "./types";

/** UKG / UltiPro Recruiting job boards. */
export const ultipro: Adapter<"ultipro"> = async ({ host, tenant, boardId }, { terms, maxPerTerm }) => {
  const board = `https://${host}/${tenant}/JobBoard/${boardId}`;
  const out: RawJob[] = [];
  for (const term of terms) {
    for (let skip = 0; skip < maxPerTerm; skip += 50) {
      const r = await getJson<any>(`${board}/JobBoardView/LoadSearchResults`, {
        json: {
          opportunitySearch: {
            Top: 50, Skip: skip, QueryString: term,
            OrderBy: [{ Value: "postedDateDesc", PropertyName: "PostedDate", Ascending: false }],
            Filters: [],
          },
          matchCriteria: {
            PreferredJobs: [], Educations: [], LicenseAndCertifications: [], Skills: [],
            hasNoLicenses: false, SkippedSkills: [],
          },
        },
      });
      const list: any[] = r.opportunities ?? [];
      for (const o of list) {
        const loc = o.Locations?.[0]?.Address;
        out.push({
          sourceId: o.Id,
          title: o.Title,
          location: loc?.City || loc?.Country
            ? [loc.City, loc.State?.Code, loc.Country?.Code].filter(Boolean).join(", ")
            : (o.Locations ?? []).map((l: any) => l.LocalizedDescription).filter(Boolean).join("; "),
          url: `${board}/OpportunityDetail?opportunityId=${o.Id}`,
          posted: o.PostedDate,
        });
      }
      if (!list.length || skip + 50 >= (r.totalCount ?? 0)) break;
    }
  }
  return out;
};

/** Breezy HR portals ({portal}.breezy.hr or white-labelled hosts). Returns everything; filtered locally. */
export const breezy: Adapter<"breezy"> = async ({ hosts }) => {
  const out: RawJob[] = [];
  for (const host of hosts) {
    const list = await getJson<any[]>(`https://${host}/json`);
    for (const j of list) {
      out.push({
        sourceId: j.id ?? j.url,
        title: j.name,
        location: j.location?.name ?? [j.location?.city, j.location?.country?.name].filter(Boolean).join(", "),
        url: j.url,
        posted: j.published_date,
      });
    }
  }
  return out;
};

/** Workable accounts (apply.workable.com/{account}). */
export const workable: Adapter<"workable"> = async ({ account }) => {
  const r = await getJson<any>(`https://apply.workable.com/api/v1/widget/accounts/${account}`);
  return (r.jobs ?? []).map((j: any) => ({
    sourceId: j.shortcode,
    title: j.title,
    location: [j.city, j.state, j.country].filter(Boolean).join(", "),
    url: j.url ?? `https://apply.workable.com/${account}/j/${j.shortcode}/`,
    posted: j.published_on,
  }));
};

/** HR-Manager (Talentech) job portals. Dates come as "/Date(ms+zone)/". */
export const hrmanager: Adapter<"hrmanager"> = async ({ customer }) => {
  const r = await getJson<any>(`https://api.hr-manager.net/jobportal.svc/${customer}/positionlist/json/`);
  return (r.Items ?? []).map((j: any) => ({
    sourceId: String(j.Id ?? j.AdvertisementUrl),
    title: j.Name,
    location: j.WorkPlace ?? "",
    url: j.AdvertisementUrl,
    posted: Number(String(j.Created ?? "").match(/\d{10,}/)?.[0]) || undefined,
  }));
};

/** ClearCompany career sites: GET careers-api.clearcompany.com/v1/{siteId} returns every job. */
export const clearcompany: Adapter<"clearcompany"> = async ({ siteId }) => {
  const r = await getJson<any>(`https://careers-api.clearcompany.com/v1/${siteId}`);
  return (r.results ?? []).map((j: any) => {
    const loc = j.locations?.[0];
    return {
      sourceId: String(j.id),
      title: j.positionTitle,
      location: loc ? [loc.city, loc.subdivision, loc.country].filter(Boolean).join(", ") : j.location,
      url: (j.applyLink ?? "").replace(/\/apply$/, "") || j.applyLink,
      posted: j.postedDate,
      text: [j.departmentName, j.jobFunctionName, j.description].filter(Boolean).join(" "),
    };
  });
};

/** ADP Workforce Now recruitment boards (cid + ccId from the embedded widget). */
export const adp: Adapter<"adp"> = async ({ cid, ccId }) => {
  const base = "https://workforcenow.adp.com/mascsr/default";
  const r = await getJson<any>(
    `${base}/careercenter/public/events/staffing/v1/job-requisitions?cid=${cid}&ccId=${ccId}&lang=en_US&locale=en_US&$top=100`,
  );
  return (r.jobRequisitions ?? []).map((j: any) => {
    const addr = j.requisitionLocations?.[0]?.address;
    // Titles are often all caps; title-case them for display.
    const title = /[a-z]/.test(j.requisitionTitle) ? j.requisitionTitle
      : String(j.requisitionTitle).toLowerCase().replace(/\b\w/g, (m: string) => m.toUpperCase());
    return {
      sourceId: String(j.itemID),
      title,
      location: addr ? [addr.cityName, addr.countrySubdivisionLevel1?.codeValue, addr.countryCode].filter(Boolean).join(", ") : "",
      url: `${base}/mdf/recruitment/recruitment.html?cid=${cid}&ccId=${ccId}&jobId=${j.itemID}&lang=en_US`,
      posted: j.postDate,
    };
  });
};

/** Paylocity boards: the listing page embeds `window.pageData = {...}` with every job. */
export const paylocity: Adapter<"paylocity"> = async ({ url }) => {
  const page = await getText(url, { robots: true });
  const data = extractJsonAfter(page, "window.pageData = ");
  return (data?.Jobs ?? []).map((j: any) => ({
    sourceId: String(j.JobId),
    title: j.JobTitle,
    location: j.JobLocation ? [j.JobLocation.City, j.JobLocation.State, j.JobLocation.Country].filter(Boolean).join(", ") : j.LocationName,
    url: `https://recruiting.paylocity.com/recruiting/jobs/Details/${j.JobId}`,
    posted: j.PublishedDate,
    text: [j.HiringDepartment, j.Description].filter(Boolean).join(" "),
  }));
};

/** Symphony Talent "m-cloud" (Google Cloud Talent) search used by some BrassRing sites. */
export const mcloud: Adapter<"mcloud"> = async ({ companyName, jobUrl }, { terms, maxPerTerm }) => {
  const out: RawJob[] = [];
  for (const term of terms) {
    for (let offset = 0; offset < maxPerTerm; offset += 50) {
      const r = await getJson<any>(
        `https://jobsapi-google.m-cloud.io/api/job/search?companyName=${encodeURIComponent(companyName)}` +
          `&query=${encodeURIComponent(term)}&pageSize=50&offset=${offset}`,
      );
      const list: any[] = r.searchResults ?? [];
      for (const { job: j, summary } of list) {
        out.push({
          sourceId: String(j.id ?? j.ref),
          title: j.title,
          location: [j.primary_city, j.primary_state, j.primary_country].filter(Boolean).join(", "),
          url: j.url ?? (jobUrl ? jobUrl.replace("{id}", j.id) : ""),
          posted: j.open_date,
          text: [j.primary_category, summary, j.description].filter(Boolean).join(" "),
        });
      }
      if (!list.length || offset + 50 >= (r.totalHits ?? 0)) break;
    }
  }
  return out;
};

/** USAJOBS keyless "historic JOA" endpoint, limited to announcements still open today. */
export const usajobs: Adapter<"usajobs"> = async ({ agency }) => {
  const d = new Date();
  const mmddyyyy = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;
  const r = await getJson<any>(
    `https://data.usajobs.gov/api/historicjoa?HiringAgencyCodes=${agency}&StartPositionCloseDate=${mmddyyyy}`,
  );
  return (r.data ?? [])
    .filter((j: any) => j.positionOpeningStatus !== "Job canceled")
    .map((j: any) => {
      const l = j.positionlocations?.[0];
      return {
        sourceId: String(j.usajobsControlNumber),
        title: j.positionTitle,
        location: l ? [l.positionLocationCity, l.positionLocationState, "US"].filter(Boolean).join(", ") : "US",
        url: `https://www.usajobs.gov/job/${j.usajobsControlNumber}`,
        posted: j.positionOpenDate,
        text: [j.hiringSubelementName, (j.jobcategories ?? []).map((c: any) => `series ${c.series}`).join(" ")].join(" "),
      };
    });
};

/** jQuery jTable search endpoints (e.g. MD Anderson): {TotalRecordCount, Records:[...]}. */
export const jtable: Adapter<"jtable"> = async ({ host }, { terms, maxPerTerm }) => {
  const strip = (s: unknown) => String(s ?? "").replace(/<[^>]+>/g, "").trim();
  const out: RawJob[] = [];
  for (const term of terms) {
    for (let start = 0; start < maxPerTerm; start += 50) {
      const r = await getJson<any>(
        `https://${host}/Search/SearchResults?keyword=${encodeURIComponent(term)}&jtStartIndex=${start}&jtPageSize=50`,
      );
      const list: any[] = r.Records ?? [];
      for (const j of list) {
        const title = strip(j.Title);
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        out.push({
          sourceId: String(j.ID),
          title,
          location: strip(j.CityStateDataAbbrev),
          url: `https://${host}/search/jobdetails/${slug}/${j.ID}`,
          posted: j.PostedDateRaw ?? strip(j.PostedDate),
          text: [strip(j.DepartmentName), strip(j.TypeName)].join(" "),
        });
      }
      if (!list.length || start + 50 >= (r.TotalRecordCount ?? 0)) break;
    }
  }
  return out;
};
