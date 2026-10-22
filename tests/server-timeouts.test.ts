import { connect } from "node:net";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_CONNECTION_TIMEOUT_MS,
  DEFAULT_KEEP_ALIVE_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from "../src/config.js";
import { buildServer } from "../src/server.js";

describe("Server timeouts", () => {
  it("applies default timeouts when not configured", async () => {
    const app = await buildServer({});
    
    expect(app.server.timeout).toBe(DEFAULT_CONNECTION_TIMEOUT_MS);
    expect(app.server.keepAliveTimeout).toBe(DEFAULT_KEEP_ALIVE_TIMEOUT_MS);
    expect(app.server.requestTimeout).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
    
    await app.close();
  });

  it("applies explicit timeout configuration", async () => {
    const app = await buildServer({
      connectionTimeoutMs: 15000,
      keepAliveTimeoutMs: 60000,
      requestTimeoutMs: 20000,
    });
    
    expect(app.server.timeout).toBe(15000);
    expect(app.server.keepAliveTimeout).toBe(60000);
    expect(app.server.requestTimeout).toBe(20000);
    
    await app.close();
  });

  it("closes a stalled request after the socket inactivity timeout", async () => {
    const app = await buildServer({
      connectionTimeoutMs: 100,
    });
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");
    const socket = connect({ host: "127.0.0.1", port: address.port });
    try {
      await new Promise<void>((resolve, reject) => {
        socket.on("error", reject);
        socket.on("close", () => resolve());
        // Leave the headers incomplete so the request stalls on the wire.
        socket.on("connect", () => socket.write("GET /health HTTP/1.1\r\nHost: localhost\r\n"));
        socket.setTimeout(2000, () => {
          socket.destroy();
          reject(new Error("Server did not close the stalled connection"));
        });
      });
      expect(socket.destroyed).toBe(true);
    } finally {
      socket.destroy();
      await app.close();
    }
  });
});
