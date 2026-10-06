import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlToMarkdown, markdownToText } from "@/lib/sources";

test("HTML descriptions become Markdown with headings, lists, bold and links", () => {
  const html =
    "<h2>About the role</h2><p>Build <strong>payments</strong> APIs. See <a href=\"https://xendit.co/eng\">our blog</a>.</p>" +
    "<h3><strong>Requirements</strong></h3><ul><li>Go &amp; Postgres</li><li>Curiosity</li></ul><p><img src=\"x.png\"></p>";
  assert.equal(
    htmlToMarkdown(html),
    "## About the role\n\nBuild **payments** APIs. See [our blog](https://xendit.co/eng).\n\n### Requirements\n\n- Go & Postgres\n- Curiosity",
  );
});

test("entity-encoded HTML is decoded before conversion", () => {
  assert.equal(htmlToMarkdown("&lt;p&gt;Payments &amp;amp; APIs&lt;/p&gt;"), "Payments & APIs");
});

test("Markdown flattens back to plain text for snippets", () => {
  assert.equal(
    markdownToText("## Role\n\n- Build **APIs** with [Go](https://go.dev)"),
    "Role Build APIs with Go",
  );
});
