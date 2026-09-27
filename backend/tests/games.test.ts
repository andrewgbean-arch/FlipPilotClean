import "./setupEnv";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import registerGamesRoute from "../routes/games";

// Operation Nightglass chapter downloads: the files the app fetches, and nothing else.

let server: http.Server;
let base = "";

before(async () => {
  const app = express();
  registerGamesRoute(app);
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(() => server.close());

test("serves a chapter page with its size and a long cache", async () => {
  const res = await fetch(`${base}/games/nightglass/chapter2.html?v=1`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  assert.match(res.headers.get("cache-control") ?? "", /max-age=604800/);
  assert.ok(Number(res.headers.get("content-length")) > 1_000_000, "a whole chapter, with a length for the progress bar");
  const page = await res.text();
  assert.match(page, /CHAPTER|Nightglass/);
});

test("anything that is not a chapter page is not found", async () => {
  for (const p of ["chapter99.html", "chapter2.htm", "..%2F..%2Fserver.ts", "notes.txt", "chapter2.html.bak"]) {
    const res = await fetch(`${base}/games/nightglass/${p}`);
    assert.equal(res.status, 404, p);
  }
});
