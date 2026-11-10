import "./setupEnv";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildInfo } from "../utils/buildInfo";

// Added 10 Nov 2026: the server's home page now says when it started and which commit it was built from, so a deploy can be checked from outside (see utils/buildInfo.ts).

const STARTED = "2026-11-10T15:50:00.000Z";

describe("what the home page says about the running build", () => {
  test("the commit Render built from, shortened to seven letters", () => {
    assert.deepEqual(buildInfo({ RENDER_GIT_COMMIT: "dc8a8d4f3c1b9a07e6d5c4b3a291807f6e5d4c3b" }, STARTED), { startedAt: STARTED, commit: "dc8a8d4" });
  });

  test("a short hash, upper case, or one with a stray space or new line", () => {
    assert.equal(buildInfo({ RENDER_GIT_COMMIT: "dc8a8d4" }, STARTED).commit, "dc8a8d4");
    assert.equal(buildInfo({ RENDER_GIT_COMMIT: "DC8A8D4F3C" }, STARTED).commit, "dc8a8d4");
    assert.equal(buildInfo({ RENDER_GIT_COMMIT: "  dc8a8d4f3c\n" }, STARTED).commit, "dc8a8d4");
  });

  test("no commit anywhere else: the field is left out, not empty", () => {
    for (const env of [{}, { RENDER_GIT_COMMIT: undefined }, { RENDER_GIT_COMMIT: "" }, { RENDER_GIT_COMMIT: "   " }]) {
      const info = buildInfo(env, STARTED);
      assert.deepEqual(info, { startedAt: STARTED });
      assert.equal("commit" in info, false);
    }
  });

  test("anything that is not a commit hash is not shown", () => {
    for (const odd of ["main", "not-a-hash", "dc8a8d", "dc8a8d4; rm -rf /", "<script>alert(1)</script>", "g".repeat(40), "d".repeat(41)]) {
      assert.equal("commit" in buildInfo({ RENDER_GIT_COMMIT: odd }, STARTED), false, odd);
    }
  });

  test("when it started is passed through as given", () => {
    assert.equal(buildInfo({}, "2020-01-01T00:00:00.000Z").startedAt, "2020-01-01T00:00:00.000Z");
  });
});
