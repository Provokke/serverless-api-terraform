import { describe, expect, it } from "vitest";
import { setup } from "./helpers.js";

describe("items API", () => {
  it("POST /items validates body and returns 400 on bad input", async () => {
    const { call } = setup();
    const bad = await call("POST", "/items", { name: "" });
    expect(bad.status).toBe(400);
    expect(bad.json.errors.length).toBeGreaterThan(0);
    const notObject = await call("POST", "/items", [1]);
    expect(notObject.status).toBe(400);
    const ok = await call("POST", "/items", { name: "Widget", description: "blue" });
    expect(ok.status).toBe(201);
    expect(ok.json).toMatchObject({ name: "Widget", version: 1 });
    expect(typeof ok.json.id).toBe("string");
  });

  it("PUT with stale version returns 409", async () => {
    const { call } = setup();
    const created = (await call("POST", "/items", { name: "A" })).json;
    const first = await call("PUT", `/items/${created.id}`, { name: "B", version: 1 });
    expect(first.status).toBe(200);
    expect(first.json.version).toBe(2);
    const stale = await call("PUT", `/items/${created.id}`, { name: "C", version: 1 });
    expect(stale.status).toBe(409);
    expect((await call("GET", `/items/${created.id}`)).json.name).toBe("B");
    expect((await call("PUT", "/items/missing", { name: "x", version: 1 })).status).toBe(404);
  });

  it("list paginates with cursor", async () => {
    const { call } = setup();
    for (const n of ["a", "b", "c", "d", "e"]) await call("POST", "/items", { name: n });
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const res = await call("GET", "/items", undefined, { limit: "2", ...(cursor ? { cursor } : {}) });
      expect(res.status).toBe(200);
      expect(res.json.items.length).toBeLessThanOrEqual(2);
      seen.push(...res.json.items.map((i: { name: string }) => i.name));
      cursor = res.json.nextCursor;
      pages++;
    } while (cursor);
    expect(pages).toBe(3);
    expect(seen.sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect((await call("GET", "/items", undefined, { limit: "0" })).status).toBe(400);
    expect((await call("GET", "/items", undefined, { cursor: "!!" })).status).toBe(400);
  });

  it("unknown route returns 404 JSON", async () => {
    const { call } = setup();
    const res = await call("GET", "/nope");
    expect(res.status).toBe(404);
    expect(res.json).toEqual({ error: "not_found" });
    expect((await call("PATCH", "/items")).status).toBe(404);
  });

  it("DELETE removes an item and 404s the second time", async () => {
    const { call } = setup();
    const created = (await call("POST", "/items", { name: "A" })).json;
    expect((await call("DELETE", `/items/${created.id}`)).status).toBe(204);
    expect((await call("DELETE", `/items/${created.id}`)).status).toBe(404);
    expect((await call("GET", `/items/${created.id}`)).status).toBe(404);
  });

  it("malformed JSON body returns 400", async () => {
    const { call } = setup();
    const event = await call("POST", "/items", undefined);
    expect(event.status).toBe(400);
  });
});
