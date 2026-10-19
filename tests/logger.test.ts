import { describe, it, expect, vi, afterEach } from "vitest";

// Mock pino before importing logger so that it uses process.stdout
vi.mock("pino", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pino")>();
  return {
    default: (opts: any) => (actual as any).default ? (actual as any).default(opts, process.stdout) : (actual as any)(opts, process.stdout)
  };
});

import pino from "pino";
import { buildLoggerSetup } from "../src/logger.js";

describe("Logger Configuration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should honour the configured log level and format", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    // Unit project LOG_LEVEL is silent, so this test constructs an explicit
    // info-level instance to check output without enabling other tests' logs.
    const logger = pino(buildLoggerSetup({ LOG_LEVEL: "info" }).options);
    
    // Explicit info level: debug messages are suppressed and info is emitted.
    logger.debug("This is a debug message");
    logger.info("This is an info message");
    
    // Since it's info level, debug should not have logged anything, 
    // info should have logged exactly once.
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    
    const loggedString = stdoutSpy.mock.calls[0][0] as string;
    const loggedObj = JSON.parse(loggedString);
    
    // Check structured format
    expect(loggedObj).toHaveProperty("level", 30); // pino info level is 30
    expect(loggedObj).toHaveProperty("msg", "This is an info message");
    expect(loggedObj).toHaveProperty("time");
    expect(loggedObj).toHaveProperty("pid");
    expect(loggedObj).toHaveProperty("hostname");
  });
});
