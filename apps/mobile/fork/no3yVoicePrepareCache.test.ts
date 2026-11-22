import { describe, expect, it } from "vite-plus/test";

import { createVoicePrepareCache } from "./no3yVoicePrepareCache";

function setup() {
  let clock = 0;
  const cache = createVoicePrepareCache<string>({ ttlMs: 1_000, now: () => clock });
  let calls = 0;
  const fetch =
    (value = "en") =>
    () => {
      calls += 1;
      return Promise.resolve(value);
    };
  return {
    cache,
    fetch,
    calls: () => calls,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe("voice prepare cache", () => {
  it("answers a fresh hit without fetching, and shares one fetch between overlapping callers", async () => {
    const { cache, fetch, calls } = setup();
    const connection = {};
    const [first, second] = await Promise.all([
      cache.read(connection, "environment", fetch()),
      cache.read(connection, "environment", fetch()),
    ]);
    expect([first, second, calls()]).toEqual(["en", "en", 1]);
    expect(await cache.read(connection, "environment", fetch("fr"))).toBe("en");
    expect(calls()).toBe(1);
  });

  it("fetches again once the entry expires", async () => {
    const { cache, fetch, calls, advance } = setup();
    const connection = {};
    await cache.read(connection, "environment", fetch());
    advance(1_000);
    expect(await cache.read(connection, "environment", fetch("fr"))).toBe("fr");
    expect(calls()).toBe(2);
  });

  it("never serves another connection's or destination's result", async () => {
    const { cache, fetch, calls } = setup();
    const connection = {};
    await cache.read(connection, "environment", fetch());
    expect(await cache.read({}, "environment", fetch("de"))).toBe("de");
    expect(await cache.read(connection, "cloud:openai", fetch("auto"))).toBe("auto");
    expect(calls()).toBe(3);
  });

  it("does not cache an error", async () => {
    const { cache, calls } = setup();
    const connection = {};
    let fail = true;
    const fetch = () => {
      if (fail) return Promise.reject(new Error("offline"));
      return Promise.resolve("en");
    };
    await expect(cache.read(connection, "environment", fetch)).rejects.toThrow("offline");
    fail = false;
    expect(await cache.read(connection, "environment", fetch)).toBe("en");
    expect(calls()).toBe(0);
  });

  it("lets a caller abort without failing the shared fetch", async () => {
    const { cache } = setup();
    const connection = {};
    let resolve: (value: string) => void = () => {};
    const fetch = () => new Promise<string>((done) => (resolve = done));
    const controller = new AbortController();
    const aborted = cache.read(connection, "environment", fetch, controller.signal);
    const waiting = cache.read(connection, "environment", fetch);
    controller.abort(new Error("cancelled"));
    resolve("en");
    await expect(aborted).rejects.toThrow("cancelled");
    expect(await waiting).toBe("en");
  });
});
