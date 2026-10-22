import { get } from "node:http";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { buildServer } from "../../src/server.js";

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function request(query: string, limit: number) {
  app = await buildServer({ queryStringLimit: limit });
  app.get("/query-limit", async () => ({ ok: true }));
  return app.inject({ method: "GET", url: `/query-limit${query}` });
}

describe("raw query-string limits", () => {
  it("rejects an oversized value containing literal question marks", async () => {
    const response = await request("?q=a?" + "x".repeat(3000), 2048);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "VALIDATION_ERROR",
      error: "query string too long",
      requestId: expect.any(String),
    });
  });

  it.each([
    ["?q=a?b?c", 7, 200],
    ["?q=a?b?c", 6, 400],
    ["?q=%3F", 5, 200],
    ["?q=%3F", 4, 400],
    ["", 1, 200],
  ])("handles %s at a limit of %i", async (query, limit, status) => {
    const response = await request(query, limit);
    expect(response.statusCode).toBe(status);
  });

  it("preserves the configured zero limit as disabled", async () => {
    const response = await request("?q=" + "x".repeat(2048), 0);
    expect(response.statusCode).toBe(200);
  });

  // inject() drops URL fragments, so exercise the router's raw # delimiter
  // with real HTTP requests instead.
  it.each([
    ["#q=" + "x".repeat(24), 16, 400],
    ["#q=" + "x".repeat(24) + "?x=1", 16, 400],
    ["#q=a?b?c", 7, 200],
    ["#q=a?b?c", 6, 400],
  ])("handles raw %s at a limit of %i", async (query, limit, status) => {
    app = await buildServer({ queryStringLimit: limit });
    let handled = false;
    app.get("/query-limit", async () => {
      handled = true;
      return { ok: true };
    });
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");

    const response = await new Promise<{ statusCode: number | undefined; body: string }>(
      (resolve, reject) => {
        get({ host: "127.0.0.1", port: address.port, path: `/query-limit${query}` }, (reply) => {
          let body = "";
          reply.setEncoding("utf8");
          reply.on("data", (chunk: string) => { body += chunk; });
          reply.on("end", () => resolve({ statusCode: reply.statusCode, body }));
          reply.on("error", reject);
        }).on("error", reject);
      },
    );

    expect(response.statusCode).toBe(status);
    expect(handled).toBe(status === 200);
    if (status === 400) {
      expect(JSON.parse(response.body)).toMatchObject({
        code: "VALIDATION_ERROR",
        error: "query string too long",
        requestId: expect.any(String),
      });
    }
  });
});
