import { beforeEach, describe, expect, it } from "vitest";
import { _resetCacheForTests } from "../cache";
import { consumeRateLimit } from "../rateLimit";

beforeEach(() => {
  _resetCacheForTests();
});

describe("consumeRateLimit", () => {
  it("allows up to the limit and rejects past it", async () => {
    const verdicts = [];
    for (let i = 0; i < 11; i += 1) {
      verdicts.push(await consumeRateLimit("1.1.1.1", { limit: 10 }));
    }
    const allowed = verdicts.filter((v) => v.allowed);
    const blocked = verdicts.filter((v) => !v.allowed);
    expect(allowed).toHaveLength(10);
    expect(blocked).toHaveLength(1);
    expect(blocked[0]?.remaining).toBe(0);
  });

  it("buckets per IP independently", async () => {
    for (let i = 0; i < 10; i += 1) {
      await consumeRateLimit("1.1.1.1", { limit: 10 });
    }
    const otherIp = await consumeRateLimit("2.2.2.2", { limit: 10 });
    expect(otherIp.allowed).toBe(true);
    expect(otherIp.remaining).toBe(9);
  });
});
