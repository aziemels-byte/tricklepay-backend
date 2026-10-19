import { describe, expect, it } from "vitest";

import { describeConfig, loadConfig } from "../src/config.js";
import { buildServer } from "../src/server.js";

// Exercise the same environment -> validated Config -> Fastify registration
// path used by the application's production startup.
const BASE_ENV = {
  DATABASE_URL: "postgresql://localhost:5432/test",
  STREAM_CONTRACT_ID: "CDMB62RVYAXJJNYYH7K442SHSAJIXTZ6K7JANGSMQF2T7MHCTVSK75SW",
};

function withOrigin<T>(value: string | undefined, run: () => T): T {
  const keys = [...Object.keys(BASE_ENV), "CORS_ORIGIN"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    Object.assign(process.env, BASE_ENV);
    if (value === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = value;
    return run();
  } finally {
    for (const key of keys) {
      const old = previous[key];
      if (old === undefined) delete process.env[key];
      else process.env[key] = old;
    }
  }
}

async function getCorsHeader(value: string | undefined, origin = "https://app.example.com") {
  const config = withOrigin(value, () => loadConfig());
  const app = await buildServer(config);
  try {
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin },
    });
    expect(response.statusCode).toBe(200);
    return {
      header: response.headers["access-control-allow-origin"],
      resolved: config.corsOrigin,
      logged: describeConfig(config).corsOrigin,
    };
  } finally {
    await app.close();
  }
}

describe("CORS_ORIGIN configuration (#550)", () => {
  it("reflects the Origin header when the setting is unset", async () => {
    expect(await getCorsHeader(undefined)).toMatchObject({
      header: "https://app.example.com",
      resolved: true,
      logged: true,
    });
  });

  it("treats CORS_ORIGIN= from the .env template like an unset value", async () => {
    expect(await getCorsHeader("")).toMatchObject({
      header: "https://app.example.com",
      resolved: true,
      logged: true,
    });
  });

  it("treats a whitespace-only value as unset", async () => {
    expect(await getCorsHeader(" \t ")).toMatchObject({
      header: "https://app.example.com",
      resolved: true,
      logged: true,
    });
  });

  it("pins a configured browser origin and includes it in startup reporting", async () => {
    expect(await getCorsHeader("https://app.example.com")).toMatchObject({
      header: "https://app.example.com",
      resolved: "https://app.example.com",
      logged: "https://app.example.com",
    });
    const mismatch = await getCorsHeader("https://app.example.com", "https://other.example.com");
    expect(mismatch.header).not.toBe("https://other.example.com");
  });

  it("rejects malformed and multiple origins before server startup", () => {
    for (const invalid of [
      "app.example.com",
      "https://app.example.com/",
      "https://a.example.com,https://b.example.com",
      "ftp://app.example.com",
    ]) {
      withOrigin(invalid, () => {
        expect(() => loadConfig()).toThrow(/CORS_ORIGIN must be a single http\(s\) origin/);
      });
    }
  });

  it("preserves explicit wildcard and opaque-origin values", () => {
    withOrigin("*", () => expect(loadConfig().corsOrigin).toBe("*"));
    withOrigin("null", () => expect(loadConfig().corsOrigin).toBe("null"));
  });
});
