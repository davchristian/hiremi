import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { adapterFor, fetchSource, USER_AGENT, type SourceRef } from "@/lib/sources";
import { parseBoardInput } from "@/lib/source-meta";
import { parseSearchCards } from "@/lib/sources/linkedin";

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

function inertiaPage(component: string, props: unknown): string {
  const json = JSON.stringify({ component, props }).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<!DOCTYPE html><html><body><div id="app" data-page="${json}"></div></body></html>`;
}

test("ycombinator reads the internships page and hydrates each job from its own page", async (t) => {
  const job = {
    id: 82011,
    title: "Software Engineering Intern",
    url: "/companies/browser-use/jobs/JwGWpEP-software-engineering-intern",
    location: "San Francisco, CA, US / Remote (US)",
    type: "Internship",
    prettyRole: "Engineering",
    roleSpecificType: "Full stack",
    companyName: "Browser Use",
  };
  const fetchMock = serve(t, {
    "https://www.ycombinator.com/internships": inertiaPage("InternshipsPage", {
      jobPostings: [job, { id: 2, title: "", url: "/companies/x/jobs/untitled" }],
    }),
    "https://www.ycombinator.com/companies/browser-use/jobs/": inertiaPage("WaasShowJobPage", {
      job: { ...job, description: "### About\n\nBuild agents & \"tools\".\n\n\n\n- TypeScript" },
    }),
  });

  const source = ref("ycombinator", "");
  const [summary, ...rest] = await fetchSource(source);
  assert.equal(rest.length, 0);
  assert.equal(String(fetchMock.mock.calls[0].arguments[0]), "https://www.ycombinator.com/internships");
  assert.equal(summary.externalId, "82011");
  assert.equal(summary.board, "internships");
  assert.equal(summary.company, "Browser Use");
  assert.equal(summary.employmentType, "Internship");
  assert.equal(summary.department, "Engineering, Full stack");
  assert.equal(summary.location, "San Francisco, CA, US; Remote (US)");
  assert.equal(summary.workplace, "unknown");
  assert.equal(summary.url, "https://www.ycombinator.com/companies/browser-use/jobs/JwGWpEP-software-engineering-intern");
  assert.equal(summary.needsHydration, true);

  const full = await adapterFor("ycombinator").hydrate!(source, summary);
  assert.equal(full.description, "### About\n\nBuild agents & \"tools\".\n\n- TypeScript");
  assert.equal(full.needsHydration, false);
  assert.equal(full.url, summary.url);
});

test("ycombinator accepts a pasted job list URL as the page to read", async (t) => {
  const fetchMock = serve(t, {
    "https://www.ycombinator.com/jobs/role/software-engineer/singapore": inertiaPage("WaasJobListingsPage", { jobPostings: [] }),
  });
  const name = await adapterFor("ycombinator").resolveName("https://www.ycombinator.com/jobs/role/Software-Engineer/singapore?x=1");
  assert.equal(name, "YC: software-engineer/singapore");
  assert.equal(fetchMock.mock.callCount(), 1);
  await assert.rejects(adapterFor("ycombinator").resolveName("companies/glimpse-2"));
});

function linkedinCard(id: string, title: string, company: string, place: string): string {
  return `<li>
    <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:${id}">
      <a class="base-card__full-link absolute" href="https://id.linkedin.com/jobs/view/${id}?position=1&amp;refId=abc">
        <span class="sr-only">${title}</span>
      </a>
      <div class="base-search-card__info">
        <h3 class="base-search-card__title">
          ${title}
        </h3>
        <h4 class="base-search-card__subtitle">
          <a class="hidden-nested-link" href="https://id.linkedin.com/company/x">${company}</a>
        </h4>
        <div class="base-search-card__metadata">
          <span class="job-search-card__location">
            ${place}
          </span>
          <time class="job-search-card__listdate" datetime="2026-10-14">1 week ago</time>
        </div>
      </div>
    </div>
  </li>`;
}

test("linkedin pages through guest search results for internships in a location", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const start = Number(new URL(String(input)).searchParams.get("start"));
    if (start > 0) return new Response("");
    return new Response(
      `<!DOCTYPE html>${linkedinCard("4478416060", "Software Engineer Intern", "PT Yonyou &amp; Co", "West Jakarta, Jakarta, Indonesia")}${linkedinCard("4441444761", "Backend Developer", "Tokopedia", "Remote")}<li><div>promo</div></li>`,
    );
  });

  const listings = await fetchSource(ref("linkedin", " "));
  assert.equal(fetchMock.mock.callCount(), 2);
  const first = new URL(String(fetchMock.mock.calls[0].arguments[0]));
  assert.equal(first.origin + first.pathname, "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search");
  assert.equal(first.searchParams.get("location"), "Indonesia");
  assert.equal(first.searchParams.get("f_JT"), "I");
  assert.equal(new URL(String(fetchMock.mock.calls[1].arguments[0])).searchParams.get("start"), "2");

  assert.equal(listings.length, 2);
  assert.equal(listings[0].externalId, "4478416060");
  assert.equal(listings[0].board, "Indonesia");
  assert.equal(listings[0].title, "Software Engineer Intern");
  assert.equal(listings[0].company, "PT Yonyou & Co");
  assert.equal(listings[0].location, "West Jakarta, Jakarta, Indonesia");
  assert.equal(listings[0].employmentType, "");
  assert.equal(first.searchParams.get("keywords"), "software engineer intern");
  assert.equal(listings[0].url, "https://id.linkedin.com/jobs/view/4478416060");
  assert.equal(listings[0].postedAt?.toISOString(), "2026-10-14T00:00:00.000Z");
  assert.equal(listings[0].needsHydration, true);
  assert.equal(listings[1].workplace, "remote");
});

test("linkedin hydrates the description and criteria from the guest job page", async (t) => {
  serve(t, {
    "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4478416060": `
      <section class="show-more-less-html" data-max-lines="5">
        <div class="show-more-less-html__markup show-more-less-html__markup--clamp-after-5
            relative overflow-hidden">
          <p>Build testable code.</p><p><strong>Requirements</strong></p><ul><li>Go</li></ul>
        </div>
        <button class="show-more-less-html__button">Show more</button>
      </section>
      <ul class="description__job-criteria-list">
        <li class="description__job-criteria-item">
          <h3 class="description__job-criteria-subheader">
            Seniority level
          </h3>
          <span class="description__job-criteria-text description__job-criteria-text--criteria">
            Internship
          </span>
        </li>
        <li class="description__job-criteria-item">
          <h3 class="description__job-criteria-subheader">
            Employment type
          </h3>
          <span class="description__job-criteria-text description__job-criteria-text--criteria">
              Internship
          </span>
        </li>
        <li class="description__job-criteria-item">
          <h3 class="description__job-criteria-subheader">
            Job function
          </h3>
          <span class="description__job-criteria-text description__job-criteria-text--criteria">
            Engineering and Information Technology
          </span>
        </li>
      </ul>`,
  });

  const source = ref("linkedin", "Indonesia");
  const [summary] = parseSearchCards(linkedinCard("4478416060", "Software Engineer Intern", "PT Yonyou", "Jakarta, Indonesia"), "Indonesia");
  const full = await adapterFor("linkedin").hydrate!(source, summary);
  assert.equal(full.description, "Build testable code.\n\n**Requirements**\n\n- Go");
  assert.equal(full.employmentType, "Internship");
  assert.equal(full.department, "Engineering and Information Technology");
  assert.equal(full.needsHydration, false);
  assert.equal(full.title, "Software Engineer Intern");
});

test("linkedin keeps the search card when rate limited and backs off further requests", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response("", { status: 429 }));
  const [summary] = parseSearchCards(linkedinCard("4441444761", "Backend Developer Intern", "Tokopedia", "Jakarta, Indonesia"), "Indonesia");

  const kept = await adapterFor("linkedin").hydrate!(ref("linkedin", "Indonesia"), summary);
  assert.equal(kept.description, "");
  assert.equal(kept.title, "Backend Developer Intern");
  assert.equal(kept.needsHydration, false);

  await assert.rejects(fetchSource(ref("linkedin", "Singapore")), /rate limiting/);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("every request identifies itself with a descriptive User-Agent", async (t) => {
  const fetchMock = serve(t, { "https://api.lever.co/v0/postings/nium": [] });
  await fetchSource(ref("lever", "nium"));
  const init = fetchMock.mock.calls[0].arguments[1] as RequestInit;
  assert.equal((init.headers as Record<string, string>)["User-Agent"], USER_AGENT);
  assert.match(USER_AGENT, /hiremi/);
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
