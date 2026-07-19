import { describe, expect, it } from "vitest";
import {
  createLazySingleton,
  decodeCursor,
  encodeCursor,
  resolvePageRequest,
} from "./index";

describe("keyset pagination", () => {
  it("round-trips a cursor", () => {
    const keyset = { sortValue: "2026-07-18T00:00:00Z", id: "abc-123" };
    expect(decodeCursor(encodeCursor(keyset))).toEqual(keyset);
  });

  it("rejects a malformed cursor", () => {
    expect(() => decodeCursor("not-a-cursor")).toThrow();
  });

  it("clamps the page size to the configured maximum", () => {
    expect(resolvePageRequest({ limit: 9999 }, { maxLimit: 100 }).limit).toBe(
      100,
    );
    expect(resolvePageRequest({ limit: 0 }).limit).toBe(1);
    expect(resolvePageRequest({}).limit).toBe(25);
  });
});

describe("lazy singleton", () => {
  it("initializes exactly once", () => {
    let calls = 0;
    const get = createLazySingleton(() => {
      calls += 1;
      return { id: calls };
    });
    expect(get()).toBe(get());
    expect(calls).toBe(1);
  });
});
