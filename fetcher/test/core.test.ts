import { describe, expect, it } from "vitest";
import { classify } from "../src/classify";
import { parsePosted } from "../src/dates";
import { detectCountry } from "../../shared/geo";
import { detectFromUrl } from "../../shared/detect";
import { isAllowed, parseRobots } from "../src/http";

const TUFTS =
  "The Department of Neuroscience ... evaluate protein expression patterns, and behaviors relevant to " +
  "psychiatric disease ... viral vectors, biochemistry and immunohistochemistry, behavioral testing in mice";

describe("classify", () => {
  it("Tufts reference: generic title, neuroscience description -> strong tech match", () => {
    const c = classify("Research Technician", TUFTS, "University");
    expect(c).toMatchObject({ role: "tech", tier: "core" });
  });
  it("same title without any description -> related, not dropped", () => {
    expect(classify("Research Technician", "", "University")).toMatchObject({ role: "tech", tier: "related" });
  });
  it("Duke reference", () =>
    expect(classify("Research Technician II", "molecular biology and cell culture, maintain mouse colonies", "University"))
      .toMatchObject({ role: "tech", tier: "core" }));
  it("Cipla reference: industry analyst", () =>
    expect(classify("Cell Biology Analyst", "drug screening assays, tissue culture, cell lines", "Pharma"))
      .toMatchObject({ role: "industry", tier: "core" }));
  it.each([
    ["Research Associate", "University", "tech"],
    ["Research Scientist 1, Neurobiology", "University", "tech"],
    ["Lab Technician", "CRO / CDMO", "industry"],
    ["Research Associate", "Biotech", "industry"],
    ["Associate Scientist, Neuroscience", "Pharma", "industry"],
    ["Fully funded PhD studentship in synaptic plasticity", "University", "phd"],
    ["Post-baccalaureate Research Fellow (IRTA)", "Government Lab", "phd"],
    ["Junior Research Fellow (JRF) - DBT project", "Research Institute", "project"],
    ["Project Associate-I", "Research Institute", "project"],
    ["Laboratory Manager - Neurobiology", "University", "tech"],
  ] as const)("%s at %s -> %s", (title, cat, role) => expect(classify(title, "", cat).role).toBe(role));
  it.each([
    "Postdoctoral Fellow in Neuroscience",
    "Assistant Professor of Biology",
    "Senior Scientist, In Vivo Pharmacology",
    "Program Manager, Research Operations",
    "Pharmacy Technician",
    "HVAC Technician",
    "Research Assistant - Department of Economics",
    "Facilities Technician",
    "Registered Nurse",
    "Specialty Anesthesia Technician - Neurology",
    "Veterinary Technician III",
    "Research Scientist/Engineer 3 - Department of Psychiatry",
    "Electrocardiograph (ECG) Technician - Cardiology",
    "Post Doctoral Research Associate in Microbiology",
    "Publication of result for the post of Senior Research Fellow (SRF)",
    "AI Research Scientist II - Office of the CTO",
    "Histology Technician - Mohs Surgery",
  ])("drops %s", (title) => expect(classify(title, "", "University").tier).toBeNull());
  it("department in the location field: off-field department drops, on-field title survives", () => {
    const text = "cell culture and microscopy";
    expect(classify("Research Assistant", text, "University", "Department of Physics").tier).toBeNull();
    expect(classify("Research Assistant", text, "University", "Department of Pathology").tier).not.toBeNull();
    expect(classify("Research Assistant in Neurobiology", text, "University", "Department of Engineering").tier).not.toBeNull();
  });
});

describe("parsePosted", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  it.each([
    ["Posted Today", "2026-10-19"],
    ["Posted Yesterday", "2026-10-18"],
    ["Posted 5 Days Ago", "2026-10-14"],
    ["Posted 30+ Days Ago", "2026-09-19"],
    ["2026-10-01T08:00:00Z", "2026-10-01"],
    ["10/03/2026", "2026-10-03"],
    ["25.09.2026", "2026-09-25"],
    ["Oct 3, 2026", "2026-10-03"],
    ["29 Sept 2026", "2026-09-29"],
    [1760000000000, "2025-10-09"],
  ])("%s", (input, out) => expect(parsePosted(input, now)).toBe(out));
});

describe("detectCountry", () => {
  it.each([
    ["Boston, Massachusetts", "US"],
    ["Cambridge, MA", "US"],
    ["Cambridge", "GB"],
    ["Durham, NC", "US"],
    ["Los Angeles, CA", "US"],
    ["Toronto, CA", "CA"],
    ["Bengaluru, IN", "IN"],
    ["Bristol, UK", "GB"],
    ["Heidelberg", "DE"],
    ["Klosterneuburg, Austria", "AT"],
    ["Mumbai, Maharashtra, India", "IN"],
    ["Pune", "IN"],
    ["TX, US, 77056", "US"],
  ])("%s -> %s", (loc, iso) => expect(detectCountry(loc)).toBe(iso));
});

describe("robots", () => {
  const rules = parseRobots("User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nAllow: /jobs/\nDisallow: /search\nDisallow: /private/*.pdf$");
  it("applies only the * group", () => {
    expect(isAllowed(rules, "/jobs/123")).toBe(true);
    expect(isAllowed(rules, "/about")).toBe(true);
    expect(isAllowed(rules, "/search?q=safety")).toBe(false);
    expect(isAllowed(rules, "/private/a.pdf")).toBe(false);
  });
});

describe("detectFromUrl", () => {
  it("workday", () =>
    expect(detectFromUrl("https://shell.wd3.myworkdayjobs.com/en-US/ShellCareers")).toEqual({
      type: "workday", host: "shell.wd3.myworkdayjobs.com", tenant: "shell", site: "ShellCareers",
    }));
  it("oracle", () =>
    expect(detectFromUrl("https://abc.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/requisitions")).toEqual({
      type: "oracle", host: "abc.fa.em2.oraclecloud.com", siteNumber: "CX_1",
    }));
  it("greenhouse", () => expect(detectFromUrl("https://boards.greenhouse.io/acme")?.board).toBe("acme"));
  it("unknown", () => expect(detectFromUrl("https://www.example.com/careers")).toBeNull());
});
