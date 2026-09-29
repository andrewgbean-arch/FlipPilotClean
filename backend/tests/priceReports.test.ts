import "./setupEnv";
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "http";
import express from "express";
import type { AddressInfo } from "net";
import * as store from "../utils/priceReportStore";
import registerPriceReportRoutes from "../routes/priceReports";

// "Doesn't look right? Report this" — a snapshot of what was on screen (title + 4 prices), not a
// free-text complaint. Store-level tests for the logic, plus a couple of route-level checks that
// the wiring (device id required, admin token required) actually works.

let base = "";
let server: http.Server;

before(async () => {
  const app = express();
  app.use(express.json());
  registerPriceReportRoutes(app);
  await new Promise<void>((ok) => {
    server = app.listen(0, "127.0.0.1", () => ok());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  // fetch()'s keep-alive sockets can otherwise sit open and hold the process open past every
  // test finishing — server.close() alone stops new connections, not existing ones.
  server?.closeAllConnections();
  server?.close();
});

const report = (deviceId: string, body: Record<string, unknown> = {}) =>
  fetch(`${base}/price-report`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": deviceId },
    body: JSON.stringify({
      title: "Hotpoint 8kg Tumble Dryer",
      retailPrice: 450,
      trendingPrice: 226,
      buyPrice: 96,
      sellPrice: 192,
      note: "Seems too low for a real dryer",
      ...body,
    }),
  });

describe("the price-report store", () => {
  test("a report is added and can be read back for that device, with no other device's reports", () => {
    const result = store.addPriceReport("phone-a", {
      title: "Vitamix A3500 Blender",
      retailPrice: 790,
      trendingPrice: 403,
      buyPrice: 201.5,
      sellPrice: null,
      note: "",
    });
    assert.equal(result.ok, true);

    const mine = store.priceReportsBy("phone-a");
    assert.equal(mine.length, 1);
    assert.equal(mine[0].title, "Vitamix A3500 Blender");
    assert.equal(mine[0].retailPrice, 790);

    assert.deepEqual(store.priceReportsBy("phone-b"), []);
  });

  test("more than 20 a day from one phone are refused", () => {
    const now = Date.now();
    for (let i = 0; i < 20; i++) {
      const r = store.addPriceReport("phone-busy", { title: `Item ${i}`, retailPrice: 1, trendingPrice: 1, buyPrice: 1, sellPrice: 1, note: "" }, now);
      assert.equal(r.ok, true, `report ${i + 1}`);
    }
    const refused = store.addPriceReport("phone-busy", { title: "One too many", retailPrice: 1, trendingPrice: 1, buyPrice: 1, sellPrice: 1, note: "" }, now);
    assert.equal(refused.ok, false);
  });

  test("deleting a device's reports removes only that device's, and returns how many", () => {
    store.addPriceReport("phone-c", { title: "Item 1", retailPrice: 1, trendingPrice: 1, buyPrice: 1, sellPrice: 1, note: "" });
    store.addPriceReport("phone-c", { title: "Item 2", retailPrice: 1, trendingPrice: 1, buyPrice: 1, sellPrice: 1, note: "" });
    store.addPriceReport("phone-d", { title: "Item 3", retailPrice: 1, trendingPrice: 1, buyPrice: 1, sellPrice: 1, note: "" });

    const removed = store.deletePriceReportsBy("phone-c");
    assert.equal(removed, 2);
    assert.deepEqual(store.priceReportsBy("phone-c"), []);
    assert.equal(store.priceReportsBy("phone-d").length, 1);
  });

  test("the admin list never includes a raw device id, only a fingerprint", () => {
    store.addPriceReport("a-real-device-id", { title: "Fingerprint check", retailPrice: 5, trendingPrice: 5, buyPrice: 5, sellPrice: 5, note: "" });
    const listed = store.priceReportList(365);
    const mine = listed.items.find((i) => i.title === "Fingerprint check");
    assert.ok(mine);
    assert.notEqual(mine!.from, "a-real-device-id");
    assert.equal(mine!.from.length, 6);
  });

  test("purging before a cutoff removes only the older ones", () => {
    const old = Date.now() - 400 * 24 * 3_600_000;
    const recent = Date.now();
    store.addPriceReport("phone-e", { title: "Old one", retailPrice: 1, trendingPrice: 1, buyPrice: 1, sellPrice: 1, note: "" }, old);
    store.addPriceReport("phone-e", { title: "Recent one", retailPrice: 1, trendingPrice: 1, buyPrice: 1, sellPrice: 1, note: "" }, recent);

    const removed = store.purgePriceReportsBefore(new Date(Date.now() - 200 * 24 * 3_600_000));
    assert.equal(removed, 1);
    const left = store.priceReportsBy("phone-e");
    assert.equal(left.length, 1);
    assert.equal(left[0].title, "Recent one");
  });
});

describe("the /price-report route", () => {
  test("refuses a request with no device id", async () => {
    const res = await fetch(`${base}/price-report`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "No device" }),
    });
    assert.equal(res.status, 400);
  });

  test("refuses a request with no title", async () => {
    const res = await report("phone-no-title", { title: "" });
    assert.equal(res.status, 400);
  });

  test("accepts a real report", async () => {
    const res = await report("phone-route-ok");
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.ok, true);
  });

  test("/admin/price-reports refuses without the admin token", async () => {
    const res = await fetch(`${base}/admin/price-reports`);
    assert.notEqual(res.status, 200);
  });

  test("/admin/price-reports lists reports with the right admin token", async () => {
    await report("phone-admin-visible");
    const res = await fetch(`${base}/admin/price-reports`, {
      headers: { "x-admin-token": String(process.env.ADMIN_TOKEN) },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.ok, true);
    assert.ok(body.items.length >= 1);
  });
});
