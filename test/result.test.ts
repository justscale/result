import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chain,
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

describe("ResultChain", () => {
  describe("isOk/isErr", () => {
    it("isOk() returns true for Ok", () => {
      assert.equal(chain(ok(42)).isOk(), true);
      assert.equal(chain(ok(42)).isErr(), false);
    });

    it("isErr() returns true for Err", () => {
      assert.equal(chain(err("error")).isErr(), true);
      assert.equal(chain(err("error")).isOk(), false);
    });
  });

  describe("accessors", () => {
    it("value accessor returns value for Ok", () => {
      assert.equal(chain(ok(42)).value, 42);
    });

    it("value accessor throws for Err", () => {
      assert.throws(() => chain(err("error")).value, /Cannot access value on Err/);
    });

    it("error accessor returns error for Err", () => {
      assert.equal(chain(err("error")).error, "error");
    });

    it("error accessor throws for Ok", () => {
      assert.throws(() => chain(ok(42)).error, /Cannot access error on Ok/);
    });
  });

  describe("map", () => {
    it("transforms Ok value", () => {
      const result = chain(ok(2)).map((x) => x * 3);
      assert.equal(result.value, 6);
    });

    it("passes through Err", () => {
      const result = chain(err<number, string>("error")).map((x) => x * 3);
      assert.equal(result.error, "error");
    });
  });

  describe("mapErr", () => {
    it("transforms Err value", () => {
      const result = chain(err("error")).mapErr((e) => e.toUpperCase());
      assert.equal(result.error, "ERROR");
    });

    it("passes through Ok", () => {
      const result = chain(ok(42)).mapErr((e) => e.toString().toUpperCase());
      assert.equal(result.value, 42);
    });
  });

  describe("flatMap", () => {
    it("chains Ok results", () => {
      const result = chain(ok(2)).flatMap((x) => ok(x * 3));
      assert.equal(result.value, 6);
    });

    it("returns first Err", () => {
      const result = chain(ok(2)).flatMap(() => err("error"));
      assert.equal(result.error, "error");
    });

    it("passes through initial Err", () => {
      const result = chain(err<number, string>("initial")).flatMap((x) => ok(x * 3));
      assert.equal(result.error, "initial");
    });
  });

  describe("unwrap methods", () => {
    it("unwrap() returns value for Ok", () => {
      assert.equal(chain(ok(42)).unwrap(), 42);
    });

    it("unwrap() throws error for Err", () => {
      assert.throws(() => chain(err(new Error("boom"))).unwrap(), /boom/);
    });

    it("unwrapOr() returns value for Ok", () => {
      assert.equal(chain(ok(42)).unwrapOr(0), 42);
    });

    it("unwrapOr() returns default for Err", () => {
      assert.equal(chain(err<number, string>("error")).unwrapOr(0), 0);
    });

    it("unwrapOrElse() returns value for Ok", () => {
      assert.equal(
        chain(ok(42)).unwrapOrElse(() => 0),
        42,
      );
    });

    it("unwrapOrElse() calls fn for Err", () => {
      assert.equal(
        chain(err<number, string>("error")).unwrapOrElse((e) => e.length),
        5,
      );
    });

    it("unwrapErr() returns error for Err", () => {
      assert.equal(chain(err("error")).unwrapErr(), "error");
    });

    it("unwrapErr() throws for Ok", () => {
      assert.throws(() => chain(ok(42)).unwrapErr(), /Called unwrapErr on Ok/);
    });
  });

  describe("match", () => {
    it("calls ok arm for Ok", () => {
      const result = chain(ok(42)).match({
        ok: (v) => `value: ${v}`,
        err: (e) => `error: ${e}`,
      });
      assert.equal(result, "value: 42");
    });

    it("calls err arm for Err", () => {
      const result = chain(err("boom")).match({
        ok: (v) => `value: ${v}`,
        err: (e) => `error: ${e}`,
      });
      assert.equal(result, "error: boom");
    });
  });

  describe("and/or combinators", () => {
    it("and() returns other for Ok", () => {
      const result = chain(ok(1)).and(ok(2));
      assert.equal(result.value, 2);
    });

    it("and() returns self for Err", () => {
      const result = chain(err<number, string>("error")).and(ok(2));
      assert.equal(result.error, "error");
    });

    it("or() returns self for Ok", () => {
      const result = chain(ok(1)).or(ok(2));
      assert.equal(result.value, 1);
    });

    it("or() returns other for Err", () => {
      const result = chain(err<number, string>("error")).or(ok(2));
      assert.equal(result.value, 2);
    });
  });

  describe("toResult", () => {
    it("returns plain Result", () => {
      const plain = chain(ok(42)).toResult();
      assert.equal(plain.ok, true);
      if (plain.ok) assert.equal(plain.value, 42);
    });
  });
});

describe("Result namespace", () => {
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
