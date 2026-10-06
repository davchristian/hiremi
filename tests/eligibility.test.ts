import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyByRules, decide, excludedByListing, extractFacts, sentencesOf } from "@/lib/eligibility";
import { translateOverlap } from "@/lib/overlap";

function status(posting: Parameters<typeof classifyByRules>[0]) {
  return classifyByRules(posting).withoutPass;
}

test("on-site in Jakarta is eligible in Indonesia", () => {
  const result = status({ title: "Software Engineer Intern", location: "Jakarta, Indonesia", description: "" });
  assert.equal(result.status, "eligible_indonesia");
  assert.equal(result.quote, "Jakarta, Indonesia");
});

test("hybrid in Bandung keeps its workplace in the reason", () => {
  const result = status({
    title: "Backend Intern",
    location: "Bandung",
    description: "This is a hybrid role with two office days a week.",
  });
  assert.equal(result.status, "eligible_indonesia");
  assert.equal(result.reason, "Hybrid in Indonesia");
});

test("remote worldwide is eligible remote", () => {
  assert.equal(
    status({ title: "Software Intern", location: "Remote (Worldwide)", description: "" }).status,
    "eligible_remote",
  );
});

test("remote limited to the US is excluded from the listing alone", () => {
  const result = excludedByListing({ title: "Data Intern", location: "Remote - US" });
  assert.equal(result?.status, "excluded");
});

test("on-site in London is excluded without reading the description", () => {
  assert.equal(excludedByListing({ title: "SWE Intern", location: "London, UK" })?.reason, "Based outside Asia");
});

test("remote with an APAC restriction sentence is eligible", () => {
  const result = status({
    title: "ML Intern",
    location: "Remote",
    description: "You must be located in the Asia-Pacific region. We pay in USD.",
  });
  assert.equal(result.status, "eligible_remote");
  assert.equal(result.reason, "Remote and open across Asia-Pacific");
  assert.equal(result.quote, "You must be located in the Asia-Pacific region.");
});

test("a restriction narrows a broad remote location", () => {
  const result = status({
    title: "Platform Intern",
    location: "Remote, APAC",
    description: "Candidates must be based in Australia or New Zealand.",
  });
  assert.equal(result.status, "excluded");
  assert.equal(result.quote, "Candidates must be based in Australia or New Zealand.");
});

test("remote with no country goes to manual review and quotes the doubt", () => {
  const result = status({ title: "Web Intern", location: "Remote", description: "We are a global team." });
  assert.equal(result.status, "check_manually");
  assert.equal(result.reason, "Remote, but no country is stated");
});

test("remote listed in another Asian country goes to manual review", () => {
  assert.equal(
    status({ title: "QA Intern", location: "Remote - Philippines", description: "" }).status,
    "check_manually",
  );
});

test("no location at all goes to manual review", () => {
  assert.equal(status({ title: "Intern", location: "", description: "" }).status, "check_manually");
});

test("Singapore roles carry a work authorization note about the Training Employment Pass", () => {
  const result = classifyByRules({
    title: "Software Engineering Intern",
    location: "Singapore",
    description: "A 12-week internship.",
    duration: "12 weeks",
  });
  assert.equal(result.withoutPass.status, "eligible_singapore");
  assert.match(result.withoutPass.workAuthorizationNote ?? "", /Training Employment Pass/);
  assert.match(result.withoutPass.workAuthorizationNote ?? "", /\(12 weeks\) fits that limit/);
  assert.match(result.withoutPass.workAuthorizationNote ?? "", /overseas universities/);
});

test("a Singapore role that won't sponsor is excluded unless the pass is confirmed", () => {
  const result = classifyByRules({
    title: "Data Intern",
    location: "Singapore",
    description: "Please note we are unable to provide visa sponsorship for this role.",
  });
  assert.equal(result.withoutPass.status, "excluded");
  assert.equal(result.withoutPass.quote, "Please note we are unable to provide visa sponsorship for this role.");
  assert.equal(result.withPass.status, "eligible_singapore");
});

test("citizenship requirements exclude, but Indonesian citizenship does not", () => {
  assert.equal(
    status({ title: "Intern", location: "Singapore", description: "Open to Singaporeans and PRs only." }).status,
    "excluded",
  );
  assert.equal(
    status({ title: "Intern", location: "Jakarta", description: "Must be an Indonesian citizen (WNI)." }).status,
    "eligible_indonesia",
  );
});

test("equal-opportunity boilerplate never counts as a citizenship rule", () => {
  const result = status({
    title: "Intern",
    location: "Jakarta",
    description:
      "We are an equal opportunity employer and hire without regard to race, religion, national origin, or citizenship status.",
  });
  assert.equal(result.status, "eligible_indonesia");
  assert.equal(sentencesOf("We are an equal opportunity employer.").length, 0);
});

test("security clearance excludes", () => {
  assert.equal(
    status({ title: "Security Intern", location: "Remote", description: "Active security clearance required." })
      .status,
    "excluded",
  );
});

test("structured remote countries decide the scope before any text", () => {
  const facts = extractFacts({
    title: "Intern",
    location: "Remote",
    workplace: "remote",
    remoteCountries: ["Indonesia", "Vietnam"],
    description: "",
  });
  assert.equal(facts.remoteScope, "indonesia");
  assert.equal(
    decide(facts, { singaporePass: false, duration: null }).status,
    "eligible_remote",
  );
});

test("country codes from the platform count as locations", () => {
  assert.equal(
    status({ title: "Intern", location: "", countryCodes: ["ID"], description: "" }).status,
    "eligible_indonesia",
  );
});

test("a stated overlap is translated into WIB hours", () => {
  assert.equal(
    translateOverlap("You should overlap with the team from 9am-1pm PT."),
    "9am-1pm Pacific time is 12am-4am WIB.",
  );
  assert.equal(
    translateOverlap("Core hours are 10:00-14:00 UTC+1."),
    "10am-2pm UTC+1 is 4pm-8pm WIB.",
  );
  assert.equal(
    translateOverlap("At least 4 hours of overlap with CET is required."),
    "4 hours of overlap with CET; WIB is 6 hours ahead.",
  );
  assert.equal(translateOverlap("PT Gojek Indonesia has flexible working hours."), null);
});

test("remote eligibility carries the overlap note", () => {
  const result = status({
    title: "Software Intern",
    location: "Remote - Worldwide",
    description: "We need 3 hours of overlap with EST each day.",
  });
  assert.equal(result.status, "eligible_remote");
  assert.equal(result.overlapNote, "3 hours of overlap with Eastern time; WIB is 12 hours ahead.");
});
