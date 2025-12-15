import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectStream,
  collectStreamAll,
  err,
  isOk,
  ok,
  Result,
  type ResultStream,
  takeUntilErr,
} from "../src/result.js";

describe("Result constructors", () => {
  it("ok() creates an Ok result", () => {
    const result = ok(42);
    assert.equal(result.ok, true);
    assert.equal(result.value, 42);
  });

  it("err() creates an Err result", () => {
    const result = err("error");
    assert.equal(result.ok, false);
    assert.equal(result.error, "error");
  });
});

describe("Type guards", () => {
  it("isOk() returns true for Ok", () => {
    assert.equal(isOk(ok(42)), true);
  });

  it("isOk() returns false for Err", () => {
    assert.equal(isOk(err("error")), false);
  });

  it("!isOk() returns true for Err", () => {
    assert.equal(!isOk(err("error")), true);
  });

  it("!isOk() returns false for Ok", () => {
    assert.equal(!isOk(ok(42)), false);
  });
});

describe("Result namespace", () => {
  describe("okOr", () => {
    it("returns value for Ok", () => {
      assert.equal(Result.okOr(ok(42), 0), 42);
    });

    it("returns default for Err", () => {
      assert.equal(Result.okOr(err("error"), 0), 0);
    });

    it("returns different type default", () => {
      const result = Result.okOr(err("error"), "default");
      assert.equal(result, "default");
    });
  });

  describe("collect", () => {
    it("collects all Ok values", () => {
      const result = Result.collect([ok(1), ok(2), ok(3)]);
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.deepEqual(result.value, [1, 2, 3]);
      }
    });

    it("returns first error (fail-fast)", () => {
      const result = Result.collect([ok(1), err("first"), ok(3), err("second")]);
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.equal(result.error, "first");
      }
    });
  });

  describe("collectAll", () => {
    it("collects all Ok values", () => {
      const result = Result.collectAll([ok(1), ok(2), ok(3)]);
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.deepEqual(result.value, [1, 2, 3]);
      }
    });

    it("accumulates all errors", () => {
      const result = Result.collectAll([ok(1), err("first"), ok(3), err("second")]);
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.deepEqual(result.error, ["first", "second"]);
      }
    });
  });

  describe("partition", () => {
    it("separates Ok and Err values", () => {
      const results = [ok(1), err("a"), ok(2), err("b"), ok(3)];
      const partitioned = Result.partition(results);
      assert.deepEqual(partitioned.ok, [1, 2, 3]);
      assert.deepEqual(partitioned.err, ["a", "b"]);
    });
  });

  describe("fromTry", () => {
    it("returns Ok for successful function", () => {
      const result = Result.fromTry(() => JSON.parse('{"a": 1}'));
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.deepEqual(result.value, { a: 1 });
      }
    });

    it("returns Err for throwing function", () => {
      const result = Result.fromTry(() => JSON.parse("invalid"));
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.ok(result.error instanceof Error);
      }
    });
  });

  describe("fromAsync", async () => {
    it("returns Ok for successful async function", async () => {
      const result = await Result.fromAsync(async () => Promise.resolve(42));
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.equal(result.value, 42);
      }
    });

    it("returns Err for rejecting async function", async () => {
      const result = await Result.fromAsync(async () => Promise.reject(new Error("boom")));
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.ok(result.error instanceof Error);
        assert.equal(result.error.message, "boom");
      }
    });
  });
});

describe("Stream utilities", () => {
  async function* createStream<T, E>(
    items: Array<{ ok: true; value: T } | { ok: false; error: E }>,
  ): ResultStream<T, E> {
    for (const item of items) {
      if (item.ok) {
        yield ok(item.value);
      } else {
        yield err(item.error);
      }
    }
  }

  describe("collectStream", () => {
    it("collects all values until error", async () => {
      const stream = createStream<number, string>([
        { ok: true, value: 1 },
        { ok: true, value: 2 },
        { ok: false, error: "error" },
        { ok: true, value: 3 },
      ]);
      const result = await collectStream(stream);
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.equal(result.error, "error");
      }
    });

    it("collects all values when no error", async () => {
      const stream = createStream<number, string>([
        { ok: true, value: 1 },
        { ok: true, value: 2 },
        { ok: true, value: 3 },
      ]);
      const result = await collectStream(stream);
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.deepEqual(result.value, [1, 2, 3]);
      }
    });
  });

  describe("collectStreamAll", () => {
    it("accumulates all errors", async () => {
      const stream = createStream<number, string>([
        { ok: true, value: 1 },
        { ok: false, error: "first" },
        { ok: true, value: 2 },
        { ok: false, error: "second" },
      ]);
      const result = await collectStreamAll(stream);
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.deepEqual(result.error, ["first", "second"]);
      }
    });
  });

  describe("takeUntilErr", () => {
    it("yields values until error", async () => {
      const stream = createStream<number, string>([
        { ok: true, value: 1 },
        { ok: true, value: 2 },
        { ok: false, error: "error" },
        { ok: true, value: 3 },
      ]);
      const values: number[] = [];
      const gen = takeUntilErr(stream);
      for await (const value of gen) {
        values.push(value);
      }
      assert.deepEqual(values, [1, 2]);
    });
  });
});
