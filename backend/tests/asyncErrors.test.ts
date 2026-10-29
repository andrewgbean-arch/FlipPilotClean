import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import path from "path";
import { spawnSync } from "child_process";
import "../utils/asyncErrors";
import express, { type NextFunction, type Request, type Response } from "express";

// The safety net in utils/asyncErrors.ts turns a failure inside an async route into one ordinary error reply instead
// of ending the whole server. It works by replacing a method inside Express's own router, so an Express update could
// quietly stop it working; these tests make that fail here instead of on the live server.

let server: http.Server;
let base = "";

before(async () => {
  const app = express();
  app.get("/ok", async (_req, res) => {
    await Promise.resolve();
    res.json({ ok: true });
  });
  app.get("/async-throws", async () => {
    throw new Error("async boom");
  });
  app.get("/async-rejects-later", async () => {
    await new Promise((r) => setTimeout(r, 5));
    await Promise.reject(new Error("later boom"));
  });
  app.get("/sync-throws", () => {
    throw new Error("sync boom");
  });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ ok: false, error: (err as Error).message });
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(() => server.close());

test("a route that fails, straight away or after waiting, gets the normal error reply", async () => {
  for (const [route, message] of [
    ["/async-throws", "async boom"],
    ["/async-rejects-later", "later boom"],
    ["/sync-throws", "sync boom"],
  ]) {
    // A timeout, so a broken safety net fails this test instead of leaving the request hanging for ever.
    const res = await fetch(base + route, { signal: AbortSignal.timeout(5000) });
    assert.equal(res.status, 500, route);
    const body = (await res.json()) as { ok: boolean; error: string };
    assert.equal(body.ok, false, route);
    assert.equal(body.error, message, route);
  }
});

test("the server carries on answering after those failures, and a good async route is untouched", async () => {
  const res = await fetch(`${base}/ok`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test("a rejection nothing caught is logged and the process keeps running", () => {
  const run = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      "require('./utils/asyncErrors'); Promise.reject(new Error('floating boom')); setTimeout(() => console.log('STILL-RUNNING'), 100);",
    ],
    { cwd: path.resolve(__dirname, ".."), encoding: "utf8", timeout: 60_000 },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /STILL-RUNNING/);
  assert.match(run.stderr, /Unhandled rejection \(the server kept running\)/);
});
