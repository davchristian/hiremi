import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanText,
  decodeEntities,
  htmlToText,
  looksRemote,
  parseDate,
  plainText,
} from "@/lib/sources/types";

test("turns markup into readable lines", () => {
  assert.equal(
    htmlToText("<p>Build APIs</p><ul><li>Go</li><li>Postgres</li></ul>"),
    "Build APIs\nGo\nPostgres",
  );
});

test("decodes entity-encoded markup before stripping it", () => {
  assert.equal(htmlToText("&lt;p&gt;Tom &amp;amp; Jerry&lt;/p&gt;"), "Tom & Jerry");
});

test("handles mostly encoded markup that also contains a raw tag", () => {
  assert.equal(
    htmlToText('&lt;h3&gt;Title&lt;/h3&gt;&lt;p&gt;Body&lt;/p&gt;<img src="x">'),
    "Title\nBody",
  );
});

test("keeps escaped angle brackets that belong to the text", () => {
  assert.equal(htmlToText("<p>Use &lt;canvas&gt; and WebGL</p>"), "Use <canvas> and WebGL");
  assert.equal(htmlToText("<p>salary < 5k</p>"), "salary < 5k");
});

test("drops scripts, styles, NUL bytes and carriage returns", () => {
  assert.equal(
    htmlToText("<style>p{}</style><script>track()</script><p>ok</p>line\r\nnext\u0000"),
    "ok\nline\nnext",
  );
});

test("decodes named, decimal and hex references and leaves unknown ones alone", () => {
  assert.equal(
    decodeEntities("a&nbsp;b &#39;c&#x27; &rsquo;d&mdash;e &#0; &bogus;"),
    "a b 'c' ’d—e &#0; &bogus;",
  );
});

test("cleans titles and company names onto one line", () => {
  assert.equal(cleanText("  Senior Java &amp; React\n  Developer "), "Senior Java & React Developer");
  assert.equal(cleanText(undefined), "");
});

test("keeps paragraph breaks in plain-text descriptions", () => {
  assert.equal(plainText("Line one  \r\n\r\n\r\n  Line two"), "Line one\n\nLine two");
});

test("parses ISO strings and epoch milliseconds, and turns garbage into null", () => {
  assert.equal(parseDate("2026-09-26T10:00:00Z")?.toISOString(), "2026-09-26T10:00:00.000Z");
  assert.equal(parseDate(1781766619816)?.getTime(), 1781766619816);
  assert.equal(parseDate("not a date"), null);
  assert.equal(parseDate(""), null);
  assert.equal(parseDate(null), null);
});

test("spots remote wording in locations and titles", () => {
  assert.equal(looksRemote("Remote - APAC"), true);
  assert.equal(looksRemote("Work from home"), true);
  assert.equal(looksRemote("Jakarta", "Backend Engineer"), false);
});
