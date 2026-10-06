import { test } from "node:test";
import assert from "node:assert/strict";
import { INDONESIA_SQL_PATTERN, INDONESIA_TERMS, isIndonesia } from "@/lib/location";

const locations: [string, boolean][] = [
  ["Boise, ID", false],
  ["Solo, Ohio", false],
  ["Baliuag, Philippines", false],
  ["Medanales, New Mexico", false],
  ["Malangas, Zamboanga Sibugay", false],
  ["Remote", false],
  ["Jakarta Selatan, DKI Jakarta, Indonesia", true],
  ["Denpasar, Bali", true],
  ["Remote - Indonesia", true],
  ["Tangerang, Banten, Indonesia", true],
  ["BANDUNG", true],
];

test("matches Indonesian places and bounds words on both sides", () => {
  for (const [location, expected] of locations) {
    assert.equal(isIndonesia(location), expected, location);
  }
});

test("never counts the ID state code or Solo as Indonesia", () => {
  const terms: readonly string[] = INDONESIA_TERMS;
  assert.equal(terms.includes("id"), false);
  assert.equal(terms.includes("solo"), false);
});

test("looks at the title as well as the location", () => {
  assert.equal(isIndonesia("Remote", "Backend Engineer (Jakarta)"), true);
  assert.equal(isIndonesia(null, undefined, ""), false);
});

test("the SQL filter uses the same terms and word bounds as the badge", () => {
  const filterAsRegExp = new RegExp(INDONESIA_SQL_PATTERN.replaceAll("\\y", "\\b"), "i");
  for (const [location, expected] of locations) {
    assert.equal(filterAsRegExp.test(location), expected, location);
  }
  for (const term of INDONESIA_TERMS) {
    assert.ok(INDONESIA_SQL_PATTERN.includes(term), term);
  }
});
