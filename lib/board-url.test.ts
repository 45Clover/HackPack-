import { test } from "node:test";
import assert from "node:assert/strict";
import { boardFromUrl } from "./board-url";

test("job-board URLs → ats + board slug", () => {
  assert.deepEqual(boardFromUrl("https://jobs.ashbyhq.com/benevity/448baa35-cd72"), { ats: "ashby", board: "benevity" });
  assert.deepEqual(boardFromUrl("https://jobs.ashbyhq.com/Jobber"), { ats: "ashby", board: "jobber" });
  assert.deepEqual(boardFromUrl("https://api.ashbyhq.com/posting-api/job-board/neofinancial"), { ats: "ashby", board: "neofinancial" });
  assert.deepEqual(boardFromUrl("https://boards.greenhouse.io/hootsuite/jobs/123"), { ats: "greenhouse", board: "hootsuite" });
  assert.deepEqual(boardFromUrl("https://job-boards.greenhouse.io/faire/jobs/9"), { ats: "greenhouse", board: "faire" });
  assert.deepEqual(boardFromUrl("https://boards.greenhouse.io/embed/job_board?for=clutch"), { ats: "greenhouse", board: "clutch" });
  assert.deepEqual(boardFromUrl("https://jobs.lever.co/caseware/04cb990e/apply"), { ats: "lever", board: "caseware" });
  assert.deepEqual(boardFromUrl("jobs.lever.co/air-tek/d30c5c37"), { ats: "lever", board: "air-tek" }); // Common Crawl style, no scheme
});

test("not a board", () => {
  assert.equal(boardFromUrl("https://linkedin.com/jobs/view/4486073062"), null);
  assert.equal(boardFromUrl("https://jobs.ashbyhq.com/"), null);
  assert.equal(boardFromUrl("https://boards.greenhouse.io/embed/job_board"), null); // no ?for=
  assert.equal(boardFromUrl("https://jobs.lever.co/robots.txt"), null);
  assert.equal(boardFromUrl("not a url at all"), null);
});
