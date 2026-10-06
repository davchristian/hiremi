import { test } from "node:test";
import assert from "node:assert/strict";
import { safeRedirectPath } from "@/lib/redirect";

const backslash = String.fromCharCode(92);

test("keeps same-site paths along with their query and hash", () => {
  assert.equal(safeRedirectPath("/feed"), "/feed");
  assert.equal(safeRedirectPath("/feed?q=go#top"), "/feed?q=go#top");
});

test("falls back to the board when there is no redirect", () => {
  assert.equal(safeRedirectPath(null), "/feed");
  assert.equal(safeRedirectPath(undefined), "/feed");
  assert.equal(safeRedirectPath(""), "/feed");
});

test("refuses every redirect that would leave the site", () => {
  const attempts = [
    "https://evil.example",
    "//evil.example",
    `/${backslash}evil.example`,
    `/${backslash}${backslash}evil.example`,
    `${backslash}${backslash}evil.example`,
    "/\t/evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
    "evil.example",
  ];
  for (const attempt of attempts) {
    assert.equal(safeRedirectPath(attempt), "/feed", JSON.stringify(attempt));
  }
});

test("treats percent-encoded slashes as an ordinary path", () => {
  assert.equal(safeRedirectPath("/%2F%2Fevil.example"), "/%2F%2Fevil.example");
});
