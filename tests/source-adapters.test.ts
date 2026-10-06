import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { adapterFor, fetchSource, USER_AGENT, type SourceRef } from "@/lib/sources";
import { parseBoardInput } from "@/lib/source-meta";

function serve(t: TestContext, routes: Record<string, unknown>) {
  return t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    const route = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((prefix) => url.startsWith(prefix));
    if (!route) return new Response("not found", { status: 404 });
    const body = routes[route];
    return typeof body === "string" ? new Response(body) : Response.json(body);
  });
}

function ref(kind: SourceRef["kind"], slug: string, label = ""): SourceRef {
  return { kind, slug, label };
}

test("greenhouse decodes entity-encoded HTML to Markdown and reads the deadline", async (t) => {
  serve(t, {
    "https://boards-api.greenhouse.io/v1/boards/xendit/jobs": {
      jobs: [
        {
          id: 7806576003,
          title: " Software Engineer Intern ",
          absolute_url: "https://job-boards.greenhouse.io/xendit/jobs/7806576003",
          company_name: "Xendit",
          first_published: "2026-07-15T22:35:43-04:00",
          application_deadline: "2026-11-30",
          content: "&lt;p&gt;Payments &amp;amp; APIs&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Go&lt;/li&gt;&lt;/ul&gt;",
          location: { name: "Jakarta, Indonesia" },
          departments: [{ name: "Engineering" }],
        },
        { id: 2, title: "", absolute_url: "https://example.com/untitled" },
      ],
    },
  });

  const [listing, ...rest] = await fetchSource(ref("greenhouse", "xendit"));
  assert.equal(rest.length, 0);
  assert.equal(listing.externalId, "xendit:7806576003");
  assert.equal(listing.board, "xendit");
  assert.equal(listing.company, "Xendit");
  assert.equal(listing.title, "Software Engineer Intern");
  assert.equal(listing.department, "Engineering");
  assert.equal(listing.description, "Payments & APIs\n\n- Go");
  assert.equal(listing.deadline?.toISOString(), "2026-11-30T00:00:00.000Z");
  assert.equal(listing.postedAt?.toISOString(), "2026-07-16T02:35:43.000Z");
});

test("lever reads workplace type, country, commitment and requirement lists", async (t) => {
  serve(t, {
    "https://api.lever.co/v0/postings/ninjavan": [
      {
        id: "0b5ca845",
        text: "Backend Engineer Intern",
        hostedUrl: "https://jobs.lever.co/ninjavan/0b5ca845",
        createdAt: 1781766619816,
        country: "ID",
        workplaceType: "hybrid",
        descriptionPlain: "Build logistics APIs.",
        lists: [{ text: "Requirements", content: "<li>Go</li><li>Postgres &amp; Redis</li>" }],
        additionalPlain: "Hybrid Fridays.",
        categories: { location: "Jakarta", allLocations: ["Jakarta"], department: "Tech", commitment: "Internship" },
      },
    ],
  });

  const [listing] = await fetchSource(ref("lever", "ninjavan", "Ninja Van"));
  assert.equal(listing.externalId, "ninjavan:0b5ca845");
  assert.equal(listing.company, "Ninja Van");
  assert.equal(listing.workplace, "hybrid");
  assert.equal(listing.remote, false);
  assert.deepEqual(listing.countryCodes, ["ID"]);
  assert.equal(listing.employmentType, "Internship");
  assert.equal(listing.postedAt?.getTime(), 1781766619816);
  assert.equal(
    listing.description,
    "Build logistics APIs.\n\n### Requirements\n\n- Go\n- Postgres & Redis\n\nHybrid Fridays.",
  );
});

test("ashby skips unlisted postings and adds the address country to the location", async (t) => {
  serve(t, {
    "https://api.ashbyhq.com/posting-api/job-board/airwallex": {
      jobs: [
        {
          id: "a1",
          title: " Software Engineer Intern (Summer 2027)",
          location: "SG - Singapore",
          employmentType: "Intern",
          workplaceType: "OnSite",
          address: { postalAddress: { addressCountry: "Singapore" } },
          isListed: true,
          jobUrl: "https://jobs.ashbyhq.com/airwallex/a1",
          publishedAt: "2026-08-05T03:32:45.901Z",
          descriptionHtml: "<p>Build <strong>payments</strong>.</p>",
        },
        { id: "a2", title: "Hidden role", jobUrl: "https://jobs.ashbyhq.com/airwallex/a2", isListed: false },
      ],
    },
  });

  const listings = await fetchSource(ref("ashby", "airwallex", "Airwallex"));
  assert.equal(listings.length, 1);
  assert.equal(listings[0].location, "SG - Singapore; Singapore");
  assert.equal(listings[0].workplace, "onsite");
  assert.equal(listings[0].employmentType, "Intern");
  assert.equal(listings[0].description, "Build **payments**.");
});

test("smartrecruiters searches for interns, pages through results, and hydrates on demand", async (t) => {
  const summary = (id: string, name: string) => ({
    id,
    name,
    company: { identifier: "Grab", name: "Grab" },
    releasedDate: "2026-10-01T06:28:17.775Z",
    location: { city: "Singapore", country: "sg", remote: false, hybrid: true, fullLocation: "Singapore, , Singapore" },
    typeOfEmployment: { label: "Intern" },
  });
  const fetchMock = serve(t, {
    "https://api.smartrecruiters.com/v1/companies/grab/postings?q=intern&limit=100&offset=0": {
      totalFound: 2,
      content: [summary("1", "Intern, Software Engineer"), summary("2", "Intern, Data Science")],
    },
    "https://api.smartrecruiters.com/v1/companies/grab/postings/1": {
      ...summary("1", "Intern, Software Engineer"),
      postingUrl: "https://jobs.smartrecruiters.com/Grab/1-intern-software-engineer",
      jobAd: {
        sections: {
          jobDescription: { title: "Job Description", text: "<p>Ship features.</p>" },
          qualifications: { title: "Qualifications", text: "<ul><li>Go</li></ul>" },
        },
      },
    },
  });

  const source = ref("smartrecruiters", "grab", "Grab");
  const listings = await fetchSource(source);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(listings.length, 2);
  assert.equal(listings[0].needsHydration, true);
  assert.equal(listings[0].location, "Singapore, Singapore");
  assert.equal(listings[0].workplace, "hybrid");
  assert.deepEqual(listings[0].countryCodes, ["sg"]);

  const hydrated = await adapterFor("smartrecruiters").hydrate!(source, listings[0]);
  assert.equal(hydrated.needsHydration, false);
  assert.equal(hydrated.url, "https://jobs.smartrecruiters.com/Grab/1-intern-software-engineer");
  assert.equal(hydrated.description, "## Job Description\n\nShip features.\n\n## Qualifications\n\n- Go");
});

test("workable returns every job with its description in one request", async (t) => {
  serve(t, {
    "https://apply.workable.com/api/v1/widget/accounts/mercari?details=true": {
      name: "Mercari, inc.",
      jobs: [
        {
          title: "Software Engineer (Internship)",
          shortcode: "B2D9916D4E",
          employment_type: "Temporary",
          experience: "Internship",
          telecommuting: true,
          department: "Engineering",
          url: "https://apply.workable.com/j/B2D9916D4E",
          published_on: "2026-05-26",
          locations: [{ country: "Japan", countryCode: "JP", city: "Minato City", region: "Tokyo" }],
          description: "<p>Build the marketplace.</p>",
        },
      ],
    },
  });

  const [listing] = await fetchSource(ref("workable", "mercari"));
  assert.equal(listing.company, "Mercari, inc.");
  assert.equal(listing.location, "Remote, Minato City, Tokyo, Japan");
  assert.equal(listing.workplace, "remote");
  assert.equal(listing.employmentType, "Temporary, Internship");
  assert.deepEqual(listing.countryCodes, ["JP"]);
});

test("catapa reads the career page JSON, its closing date and sections", async (t) => {
  serve(t, {
    "https://api-apps.catapa.com/careerpage/gdplabs/jobs?page=0": {
      last: true,
      content: [
        {
          id: "019b",
          tenant: "GDPLabs",
          jobTitle: { name: "Software Development Engineer - Internship" },
          jobLink: "/GDPLabs/019b",
          jobStatus: "PUBLISHED",
          organization: { name: "GDP Labs" },
          location: { name: "Jakarta", city: { name: "Jakarta Selatan" } },
          jobDetail: {
            open: 1790593205728,
            close: 1798761600000,
            description: "<div>Build GenAI tools.</div>",
            requirement: "<ul><li>Python</li></ul>",
            employmentType: { name: "Internship" },
          },
        },
      ],
    },
  });

  const [listing] = await fetchSource(ref("catapa", "gdplabs"));
  assert.equal(listing.company, "GDP Labs");
  assert.equal(listing.url, "https://career.catapa.com/GDPLabs/019b");
  assert.equal(listing.location, "Jakarta, Indonesia");
  assert.equal(listing.deadline?.getTime(), 1798761600000);
  assert.equal(listing.description, "## Description\n\nBuild GenAI tools.\n\n## Requirements\n\n- Python");
});

test("the muse filters internships by category and pages until the last page", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const page = Number(new URL(String(input)).searchParams.get("page"));
    return Response.json({
      page_count: 2,
      results: [
        {
          id: 100 + page,
          name: "Software Engineering Intern",
          contents: "<p>Hello</p>",
          locations: [{ name: page === 0 ? "Flexible / Remote" : "Singapore" }],
          levels: [{ name: "Internship" }],
          refs: { landing_page: `https://www.themuse.com/jobs/x/${page}` },
          company: { name: "Acme Robotics" },
        },
      ],
    });
  });

  const listings = await fetchSource(ref("themuse", ""));
  assert.equal(fetchMock.mock.callCount(), 2);
  const url = new URL(String(fetchMock.mock.calls[0].arguments[0]));
  assert.equal(url.searchParams.get("category"), "Software Engineering");
  assert.equal(url.searchParams.get("level"), "Internship");
  assert.equal(listings[0].workplace, "remote");
  assert.equal(listings[1].location, "Singapore");
  assert.equal(listings[0].department, "");
});

test("himalayas lists remote internships open to a country and links to Himalayas", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const page = Number(new URL(String(input)).searchParams.get("page") ?? "1");
    return Response.json({
      totalCount: 21,
      jobs: Array.from({ length: page === 1 ? 20 : 1 }, (_, index) => ({
        title: "Data Analyst (Intern)",
        companyName: "Nearby",
        employmentType: "Intern",
        locationRestrictions: index === 0 ? ["Indonesia", "Vietnam"] : [],
        description: "<p>Analyse data.</p>",
        pubDate: 1791201872,
        guid: `https://himalayas.app/companies/nearby/jobs/data-analyst-${page}-${index}`,
      })),
    });
  });

  const listings = await fetchSource(ref("himalayas", ""));
  assert.equal(fetchMock.mock.callCount(), 2);
  assert.equal(new URL(String(fetchMock.mock.calls[0].arguments[0])).searchParams.get("country"), "Indonesia");
  assert.equal(listings.length, 21);
  assert.equal(listings[0].location, "Remote (Indonesia, Vietnam)");
  assert.deepEqual(listings[0].remoteCountries, ["Indonesia", "Vietnam"]);
  assert.equal(listings[1].location, "Remote (Worldwide)");
  assert.match(listings[0].url, /^https:\/\/himalayas\.app\//);
});

test("every request identifies itself with a descriptive User-Agent", async (t) => {
  const fetchMock = serve(t, { "https://api.lever.co/v0/postings/nium": [] });
  await fetchSource(ref("lever", "nium"));
  const init = fetchMock.mock.calls[0].arguments[1] as RequestInit;
  assert.equal((init.headers as Record<string, string>)["User-Agent"], USER_AGENT);
  assert.match(USER_AGENT, /job-tracker/);
});

test("a board that answers with an error status throws, so ingest can record it", async (t) => {
  serve(t, {});
  await assert.rejects(fetchSource(ref("lever", "does-not-exist")), /responded 404/);
});

test("resolving a board name validates it and returns a display name", async (t) => {
  serve(t, {
    "https://boards-api.greenhouse.io/v1/boards/okta": { name: "Okta" },
    "https://api.lever.co/v0/postings/ninja-van": [],
    "https://api.lever.co/v0/postings/nope": { ok: false, error: "Document not found" },
  });
  assert.equal(await adapterFor("greenhouse").resolveName("okta"), "Okta");
  assert.equal(await adapterFor("lever").resolveName("ninja-van"), "Ninja Van");
  await assert.rejects(adapterFor("lever").resolveName("nope"));
});

test("pasted board URLs are recognised for every board platform", () => {
  assert.deepEqual(parseBoardInput("https://job-boards.greenhouse.io/xendit"), { kind: "greenhouse", slug: "xendit" });
  assert.deepEqual(parseBoardInput("boards.greenhouse.io/okta/jobs/123"), { kind: "greenhouse", slug: "okta" });
  assert.deepEqual(parseBoardInput("https://jobs.lever.co/ninjavan/0b5c"), { kind: "lever", slug: "ninjavan" });
  assert.deepEqual(parseBoardInput("https://jobs.ashbyhq.com/openai"), { kind: "ashby", slug: "openai" });
  assert.deepEqual(parseBoardInput("https://jobs.smartrecruiters.com/Grab"), { kind: "smartrecruiters", slug: "Grab" });
  assert.deepEqual(parseBoardInput("https://apply.workable.com/mercari/"), { kind: "workable", slug: "mercari" });
  assert.deepEqual(parseBoardInput("https://career.catapa.com/GDPLabs"), { kind: "catapa", slug: "GDPLabs" });
  assert.equal(parseBoardInput("xendit"), null);
});
