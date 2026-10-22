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
});
