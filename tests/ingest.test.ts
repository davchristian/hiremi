import { afterEach, beforeEach, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/db";
import {
  buildCloseMissing,
  buildListingUpsert,
  listingEmbeddingText,
  prepareListingRows,
  selectForStorage,
} from "@/lib/ingest";
import { cycleIsDue } from "@/lib/refresh";
import {
  EMBEDDING_BATCH_SIZE,
  embedMany,
  embeddingFingerprint,
  isEmbeddingConfigured,
} from "@/lib/embeddings";
import { listing as normalized, type NormalizedListing } from "@/lib/sources";

function listing(overrides: Partial<NormalizedListing> = {}): NormalizedListing {
  return normalized({
    source: "greenhouse",
    externalId: "xendit:1",
    board: "xendit",
    company: "Xendit",
    title: "Software Engineer Intern",
    description: "Build payment APIs.",
    location: "Jakarta, Indonesia",
    url: "https://job-boards.greenhouse.io/xendit/jobs/1",
    ...overrides,
  });
}

function voyageReply(init: RequestInit | undefined, order?: number[]) {
  const { input } = JSON.parse(String(init?.body)) as { input: string[] };
  const indexes = order ?? input.map((_, index) => index);
  return Response.json({
    data: indexes.map((index) => ({ index, embedding: [index, input.length] })),
  });
}

function skipBackoff(t: TestContext): number[] {
  const delays: number[] = [];
  t.mock.method(globalThis, "setTimeout", (callback: () => void, delay?: number) => {
    delays.push(delay ?? 0);
    queueMicrotask(callback);
  });
  return delays;
}

beforeEach(() => {
  process.env.VOYAGE_API_KEY = "test-key";
});

afterEach(() => {
  delete process.env.VOYAGE_API_KEY;
});

test("a listing repeated within one batch is upserted once", () => {
  const rows = prepareListingRows([
    listing({ externalId: "xendit:2", title: "First copy" }),
    listing({ externalId: "xendit:1" }),
    listing({ externalId: "xendit:2", title: "Second copy" }),
  ]);
  assert.deepEqual(
    rows.map((row) => [row.externalId, row.title]),
    [
      ["xendit:1", "Software Engineer Intern"],
      ["xendit:2", "Second copy"],
    ],
  );
});

test("the same external id from two sources stays two listings", () => {
  const rows = prepareListingRows([
    listing({ source: "greenhouse", externalId: "7" }),
    listing({ source: "lever", externalId: "7" }),
  ]);
  assert.equal(rows.length, 2);
});

test("each row carries the fingerprint of the text it would be embedded from", () => {
  const [row] = prepareListingRows([listing()]);
  assert.equal(row.embeddingSource, embeddingFingerprint(listingEmbeddingText(row)));
});

test("re-fetching an unchanged listing keeps its fingerprint, so it costs no embedding", () => {
  const [first] = prepareListingRows([listing({ postedAt: new Date("2026-09-01") })]);
  const [refetched] = prepareListingRows([
    listing({ postedAt: new Date("2026-09-20"), url: "https://example.com/moved" }),
  ]);
  const [edited] = prepareListingRows([listing({ description: "Build faster payment APIs." })]);
  assert.equal(refetched.embeddingSource, first.embeddingSource);
  assert.notEqual(edited.embeddingSource, first.embeddingSource);
});

test("vectors are placed by the index Voyage returns, not by array position", async (t) => {
  t.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) =>
    voyageReply(init, [2, 0, 1]),
  );
  const vectors = await embedMany(["a", "b", "c"], "document");
  assert.deepEqual(
    vectors.map((vector) => vector[0]),
    [0, 1, 2],
  );
});

test("large inputs are split into batches Voyage accepts", async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, init?: RequestInit) => voyageReply(init),
  );
  const texts = Array.from({ length: EMBEDDING_BATCH_SIZE + 4 }, (_, index) => `text ${index}`);
  const vectors = await embedMany(texts, "document");
  assert.equal(vectors.length, texts.length);
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("requests use voyage-4 with the right input type, the API key, and truncated text", async (t) => {
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async (_input: RequestInfo | URL, init?: RequestInit) => voyageReply(init),
  );
  await embedMany(["listing text", "x".repeat(9_000)], "document");
  await embedMany(["profile text"], "query");

  const [listingCall, profileCall] = fetchMock.mock.calls.map((call) => call.arguments);
  const listingInit = listingCall[1] as RequestInit;
  assert.equal(String(listingCall[0]), "https://api.voyageai.com/v1/embeddings");
  assert.equal(listingInit.method, "POST");
  assert.deepEqual(listingInit.headers, {
    "Content-Type": "application/json",
    Authorization: "Bearer test-key",
  });
  const listingBody = JSON.parse(String(listingInit.body));
  assert.equal(listingBody.model, "voyage-4");
  assert.equal(listingBody.input_type, "document");
  assert.equal(listingBody.input[0], "listing text");
  assert.equal(listingBody.input[1].length, 8_000);
  assert.equal(JSON.parse(String((profileCall[1] as RequestInit).body)).input_type, "query");
});

test("a rate limit is retried after a short backoff", async (t) => {
  const delays = skipBackoff(t);
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    return calls === 1 ? new Response("slow down", { status: 429 }) : voyageReply(init);
  });
  const [vector] = await embedMany(["a"], "query");
  assert.deepEqual(vector, [0, 1]);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [500]);
});

test("other client errors fail fast without a retry", async (t) => {
  const delays = skipBackoff(t);
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("invalid key", { status: 401 }),
  );
  await assert.rejects(embedMany(["a"], "query"), /401/);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.deepEqual(delays, []);
});

test("server errors give up after three attempts with growing backoff", async (t) => {
  const delays = skipBackoff(t);
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("unavailable", { status: 503 }),
  );
  await assert.rejects(embedMany(["a"], "query"), /503/);
  assert.equal(fetchMock.mock.callCount(), 3);
  assert.deepEqual(delays, [500, 1000]);
});

test("embedding only counts as configured while a key is set", () => {
  assert.equal(isEmbeddingConfigured(), true);
  delete process.env.VOYAGE_API_KEY;
  assert.equal(isEmbeddingConfigured(), false);
});

test("rows are classified and carry season, duration and deadline hints", () => {
  const [row] = prepareListingRows(
    [
      listing({
        title: "Software Engineer Intern (Summer 2027)",
        location: "Singapore",
        description: "A 12-week internship. Applications close: 30 Nov 2026.",
      }),
    ],
    new Date("2026-10-06T00:00:00Z"),
  );
  assert.equal(row.eligibility, "eligible_singapore");
  assert.equal(row.eligibilityWithPass, "eligible_singapore");
  assert.equal(row.season, "Summer 2027");
  assert.equal(row.seasonStart?.toISOString(), "2027-06-01T00:00:00.000Z");
  assert.equal(row.duration, "12 weeks");
  assert.equal(row.deadline?.toISOString(), "2026-11-30T00:00:00.000Z");
  assert.match(row.workAuthorizationNote ?? "", /Training Employment Pass/);
  assert.equal(row.eligibilityMethod, "rules");
});

test("a platform deadline wins over one found in the text", () => {
  const [row] = prepareListingRows([
    listing({ deadline: new Date("2026-12-01T00:00:00Z"), description: "Apply by 15 November 2026." }),
  ]);
  assert.equal(row.deadline?.toISOString(), "2026-12-01T00:00:00.000Z");
});

test("re-ingesting keeps the stored eligibility unless the posting's content changed", () => {
  const { sql } = buildListingUpsert(db, prepareListingRows([listing()])).toSQL();
  assert.match(
    sql,
    /"eligibility" = CASE WHEN "job_listings"\."embedding_source" IS DISTINCT FROM excluded\.embedding_source OR "job_listings"\."eligibility" IS NULL THEN excluded\."eligibility" ELSE "job_listings"\."eligibility" END/,
  );
  assert.match(sql, /"embedding" = CASE WHEN "job_listings"\."embedding_source" IS DISTINCT FROM excluded\.embedding_source THEN NULL/);
  assert.match(sql, /"changed_at" = CASE WHEN .* THEN now\(\)/);
  assert.match(sql, /"last_seen_at" = now\(\)/);
  assert.match(sql, /"closed_at" = CASE WHEN excluded\.deadline IS NOT NULL AND excluded\.deadline < date_trunc\('day', now\(\)\)/);
});

test("a complete board closes the postings it no longer lists, scoped to that board", () => {
  const { sql, params } = buildCloseMissing(db, "greenhouse", "xendit", ["xendit:1", "xendit:2"]).toSQL();
  assert.match(
    sql,
    /^update "job_listings" set "closed_at" = now\(\), "closed_reason" = \$1 where \("job_listings"\."source" = \$2 and "job_listings"\."board" = \$3 and "job_listings"\."closed_at" is null and "job_listings"\."external_id" not in \(\$4, \$5\)\)/,
  );
  assert.deepEqual(params.slice(0, 5), ["No longer listed on the board", "greenhouse", "xendit", "xendit:1", "xendit:2"]);
});

test("an empty board closes everything it used to list", () => {
  const { sql } = buildCloseMissing(db, "lever", "nium", []).toSQL();
  assert.doesNotMatch(sql, /not in/);
});

test("only new postings are hydrated, and ones the listing already excludes are stored without a fetch", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      id: "3",
      name: "Intern, Software Engineer",
      location: { city: "Singapore", country: "sg", fullLocation: "Singapore" },
      jobAd: { sections: { jobDescription: { title: "Job Description", text: "<p>Ship it.</p>" } } },
    }),
  );
  const source = { kind: "smartrecruiters" as const, slug: "grab", label: "Grab" };
  const item = (id: string, location: string) =>
    listing({ source: "smartrecruiters", externalId: `grab:${id}`, board: "grab", location, needsHydration: true });

  const { store, touch } = await selectForStorage(
    source,
    [item("1", "Singapore"), item("2", "Beijing, China"), item("3", "Singapore")],
    new Set(["grab:1"]),
  );

  assert.deepEqual(touch, ["grab:1"]);
  assert.deepEqual(store.map((entry) => entry.externalId), ["grab:2", "grab:3"]);
  assert.equal(store[0].description, "Build payment APIs.");
  assert.equal(store[1].description, "## Job Description\n\nShip it.");
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("failed hydrations are counted and their listings left for the next cycle", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("", { status: 503 }));
  const source = { kind: "smartrecruiters" as const, slug: "grab", label: "Grab" };
  const item = (id: string) =>
    listing({ source: "smartrecruiters", externalId: `grab:${id}`, board: "grab", location: "Singapore", needsHydration: true });

  const selection = await selectForStorage(source, [item("1"), item("2")], new Set());

  assert.deepEqual(selection.store, []);
  assert.equal(selection.hydrated, 2);
  assert.equal(selection.failed, 2);
  assert.match(selection.firstError ?? "", /responded 503/);
});

test("no hydration starts once the refresh deadline has passed", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json({}));
  const source = { kind: "smartrecruiters" as const, slug: "grab", label: "Grab" };
  const item = listing({ source: "smartrecruiters", externalId: "grab:1", board: "grab", location: "Singapore", needsHydration: true });

  const selection = await selectForStorage(source, [item], new Set(), 0);

  assert.deepEqual(selection.store, []);
  assert.equal(selection.hydrated, 0);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("a new refresh cycle starts once the previous one finished and 72 hours have passed", () => {
  const now = new Date("2026-10-06T12:00:00Z");
  assert.equal(cycleIsDue(null, now), true);
  assert.equal(cycleIsDue({ startedAt: new Date("2026-10-04T12:00:00Z"), finishedAt: new Date() }, now), false);
  assert.equal(cycleIsDue({ startedAt: new Date("2026-10-03T11:00:00Z"), finishedAt: new Date() }, now), true);
  assert.equal(cycleIsDue({ startedAt: new Date("2026-10-01T00:00:00Z"), finishedAt: null }, now), false);
});
