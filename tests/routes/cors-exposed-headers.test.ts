import { describe, expect, it } from "vitest";

import { buildServer } from "../../src/server.js";

const EXPECTED_EXPOSED_HEADERS = [
  "etag",
  "retry-after",
  "x-request-id",
  "link",
  "x-indexer-lag-ledgers",
];

function exposedHeaders(header: string | string[] | number | undefined): string[] {
  expect(typeof header).toBe("string");
  return String(header)
    .split(",")
    .map((name) => name.trim().toLowerCase());
}

describe("CORS exposed response headers (#563)", () => {
  it("exposes tracing, caching and pagination headers to a browser", async () => {
    const app = await buildServer();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "https://frontend.example" },
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://frontend.example",
      );
      expect(exposedHeaders(response.headers["access-control-expose-headers"])).toEqual(
        EXPECTED_EXPOSED_HEADERS,
      );
      expect(response.headers["x-request-id"]).toBeTruthy();
    } finally {
      await app.close();
    }
  });

  it("exposes Retry-After on an early rate-limited response", async () => {
    const app = await buildServer({
      rateLimitMax: 1,
      rateLimitWindowMs: 60_000,
    });
    try {
      const options = {
        method: "GET" as const,
        url: "/health",
        headers: { origin: "https://frontend.example" },
      };
      const first = await app.inject(options);
      expect(first.statusCode).toBe(200);
      const limited = await app.inject(options);
      expect(limited.statusCode).toBe(429);
      expect(limited.headers["retry-after"]).toBeTruthy();
      expect(limited.headers["access-control-allow-origin"]).toBe(
        "https://frontend.example",
      );
      expect(exposedHeaders(limited.headers["access-control-expose-headers"])).toEqual(
        EXPECTED_EXPOSED_HEADERS,
      );
    } finally {
      await app.close();
    }
  });
});
