import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ getIndexerPosition: vi.fn() }));
vi.mock("../src/repositories/indexer-state.js", () => state);

let app: FastifyInstance | undefined;

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function read(status = 200) {
  const { registerIndexerLagHook } = await import("../src/indexer-lag-hook.js");
  app = Fastify();
  registerIndexerLagHook(app);
  app.get("/read", async (_request, reply) => reply.code(status).send({ status }));
  return app.inject({ method: "GET", url: "/read" });
}

describe("optional indexer lag metadata", () => {
  it("adds the lag header when indexer state is available", async () => {
    state.getIndexerPosition.mockResolvedValue({
      lastLedger: 100,
      chainLedger: 112,
      cursor: null,
      updatedAt: new Date(),
    });
    const response = await read();
    expect(response.statusCode).toBe(200);
    expect(response.headers["x-indexer-lag-ledgers"]).toBe("12");
  });

  it("omits the header before the first indexer position", async () => {
    state.getIndexerPosition.mockResolvedValue(null);
    const response = await read();
    expect(response.statusCode).toBe(200);
    expect(response.headers["x-indexer-lag-ledgers"]).toBeUndefined();
  });

  it.each([200, 400])("preserves a %i response when the metadata lookup fails", async (status) => {
    state.getIndexerPosition.mockRejectedValue(new Error("database unavailable"));
    const response = await read(status);
    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual({ status });
    expect(response.headers["x-indexer-lag-ledgers"]).toBeUndefined();
  });
});
