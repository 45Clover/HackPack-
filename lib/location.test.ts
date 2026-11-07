import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLocation } from "./location";

test("cities, remote, and what counts as Canada", () => {
  assert.deepEqual(parseLocation("Calgary, Alberta"), { city: "Calgary", remote: false, canada: true });
  assert.deepEqual(parseLocation("Remote in Toronto"), { city: "Toronto", remote: true, canada: true });
  assert.deepEqual(parseLocation("Montréal, QC"), { city: "Montreal", remote: false, canada: true });
  assert.deepEqual(parseLocation("Remote - Canada"), { city: null, remote: true, canada: true });
  assert.equal(parseLocation("Remote").canada, false); // could be anywhere
  assert.equal(parseLocation("San Francisco, CA").canada, false); // CA = California
  assert.equal(parseLocation("New York, NY").canada, false);
});
