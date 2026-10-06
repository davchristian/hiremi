import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "@/db";
import type { Profile } from "@/db/schema";
import { buildFeedQuery, parseFeedLimit, parseFeedSort } from "@/lib/feed";
import { INDONESIA_SQL_PATTERN } from "@/lib/location";

const userId = "11111111-1111-4111-8111-111111111111";

function profile(embedding: number[] | null): Profile {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    userId,
    targetRoles: ["Backend Engineer"],
    skills: ["Go"],
    experienceLevel: "student",
    locationPreference: "",
    workMode: "any",
    blurb: "",
    singaporePassConfirmed: false,
    embedding,
    embeddingSource: embedding ? "hash" : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function orderByClause(sql: string): string {
  return sql.slice(sql.indexOf(" order by "));
}

test("match sorting ranks by raw cosine distance ascending, the form the HNSW index can serve", () => {
  const { sql, params } = buildFeedQuery(db, userId, profile([0.1, 0.2]), { sort: "match" }).toSQL();
  const orderBy = orderByClause(sql);
  assert.match(orderBy, /^ order by "job_listings"\."embedding" <=> \$\d+::vector asc/);
  assert.doesNotMatch(orderBy, /1 -|desc/);
  assert.ok(params.includes("[0.1,0.2]"));
  assert.match(sql, /"job_listings"\."embedding" is not null/);
});

test("without a profile embedding match sorting falls back to date", () => {
  const { sql } = buildFeedQuery(db, userId, profile(null), { sort: "match" }).toSQL();
  assert.doesNotMatch(sql, /<=>/);
  assert.match(orderByClause(sql), /^ order by "job_listings"\."posted_at" desc nulls last/);
});

test("the Indonesia filter matches whole words in the location or title", () => {
  const { sql, params } = buildFeedQuery(db, userId, null, { indonesiaOnly: true }).toSQL();
  assert.match(
    sql,
    /\("job_listings"\."location" \|\| ' ' \|\| "job_listings"\."title"\) ~\* \$\d+/,
  );
  assert.ok(params.includes(INDONESIA_SQL_PATTERN));
});

test("tracked listings are joined only for the signed-in user and can be hidden", () => {
  const { sql, params } = buildFeedQuery(db, userId, null, { hideTracked: true }).toSQL();
  assert.match(
    sql,
    /left join "jobs" on \("jobs"\."listing_id" = "job_listings"\."id" and "jobs"\."user_id" = \$\d+\)/,
  );
  assert.match(sql, /"jobs"\."id" is null/);
  assert.ok(params.includes(userId));
});

test("text search matches title or company and treats % and _ literally", () => {
  const { sql, params } = buildFeedQuery(db, userId, null, { query: " 50%_off " }).toSQL();
  assert.match(sql, /"job_listings"\."title" ilike \$\d+ or "job_listings"\."company" ilike \$\d+/);
  assert.ok(params.includes("%50\\%\\_off%"));
});

test("remote-only filters on the workplace, and the limit reaches the query outside priority sorting", () => {
  const { sql, params } = buildFeedQuery(db, userId, null, {
    remoteOnly: true,
    limit: 25,
    sort: "newest",
  }).toSQL();
  assert.match(sql, /"job_listings"\."workplace" = \$\d+/);
  assert.match(sql, / limit \$\d+$/);
  assert.equal(params.at(-1), 25);
});

test("priority sorting reads a larger pool and ranks it in code", () => {
  const { params } = buildFeedQuery(db, userId, null, { limit: 25 }).toSQL();
  assert.equal(params.at(-1), 400);
});

test("closed and excluded postings are hidden, and the user's own override wins", () => {
  const { sql } = buildFeedQuery(db, userId, profile(null)).toSQL();
  assert.match(sql, /"job_listings"\."closed_at" is null/);
  assert.match(sql, /coalesce\("listing_reviews"\."status", "job_listings"\."eligibility"\) <> 'excluded'/);
  assert.match(
    sql,
    /left join "listing_reviews" on \("listing_reviews"\."listing_id" = "job_listings"\."id" and "listing_reviews"\."user_id" = \$\d+\)/,
  );
});

test("a confirmed Singapore work pass reads the with-pass status", () => {
  const withPass = { ...profile(null), singaporePassConfirmed: true };
  const { sql } = buildFeedQuery(db, userId, withPass).toSQL();
  assert.match(sql, /coalesce\("listing_reviews"\."status", "job_listings"\."eligibility_with_pass"\)/);
});

test("excluded postings can be shown on request, and statuses can be filtered", () => {
  const { sql, params } = buildFeedQuery(db, userId, null, {
    includeExcluded: true,
    statuses: ["eligible_singapore"],
  }).toSQL();
  assert.doesNotMatch(sql, /<> 'excluded'/);
  assert.ok(params.includes("eligible_singapore"));
});

test("the limit from the URL is a whole number between 1 and 100, 40 when missing", () => {
  assert.equal(parseFeedLimit(null), 40);
  assert.equal(parseFeedLimit(""), 40);
  assert.equal(parseFeedLimit("abc"), 40);
  assert.equal(parseFeedLimit("25"), 25);
  assert.equal(parseFeedLimit("12.7"), 12);
  assert.equal(parseFeedLimit("0"), 1);
  assert.equal(parseFeedLimit("-5"), 1);
  assert.equal(parseFeedLimit("5000"), 100);
  assert.equal(parseFeedLimit("Infinity"), 40);
});

test("unknown sort values fall back to priority", () => {
  assert.equal(parseFeedSort("match"), "match");
  assert.equal(parseFeedSort("newest"), "newest");
  assert.equal(parseFeedSort("random"), "priority");
  assert.equal(parseFeedSort(null), "priority");
});
