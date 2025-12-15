import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chainOption, isSome, none, some } from "../src/option.js";
import {
  chain,
  collectStream,
  collectStreamAll,
  err,
  isOk,
  ok,
  Result,
  type ResultStream,
} from "../src/result.js";

describe("Result edge cases", () => {
  describe("ok() with special values", () => {
    it("handles undefined value", () => {
      const result = ok(undefined);
      assert.equal(result.ok, true);
      assert.equal(result.value, undefined);
    });

    it("handles null value", () => {
      const result = ok(null);
      assert.equal(result.ok, true);
      assert.equal(result.value, null);
    });

    it("handles false value", () => {
      const result = ok(false);
      assert.equal(result.ok, true);
      assert.equal(result.value, false);
    });

    it("handles 0 value", () => {
      const result = ok(0);
      assert.equal(result.ok, true);
      assert.equal(result.value, 0);
    });

    it("handles empty string value", () => {
      const result = ok("");
      assert.equal(result.ok, true);
      assert.equal(result.value, "");
    });

    it("handles NaN value", () => {
      const result = ok(NaN);
      assert.equal(result.ok, true);
      assert.equal(Number.isNaN(result.value), true);
    });
  });

  describe("err() with special values", () => {
    it("handles undefined error", () => {
      const result = err(undefined);
      assert.equal(result.ok, false);
      assert.equal(result.error, undefined);
    });

    it("handles null error", () => {
      const result = err(null);
      assert.equal(result.ok, false);
      assert.equal(result.error, null);
    });

    it("handles false error", () => {
      const result = err(false);
      assert.equal(result.ok, false);
      assert.equal(result.error, false);
    });

    it("handles 0 error", () => {
      const result = err(0);
      assert.equal(result.ok, false);
      assert.equal(result.error, 0);
    });

    it("handles empty string error", () => {
      const result = err("");
      assert.equal(result.ok, false);
      assert.equal(result.error, "");
    });
  });

  describe("nested Results", () => {
    it("handles Result<Result<T, E>, F>", () => {
      const inner = ok(42);
      const outer = ok(inner);
      assert.equal(isOk(outer), true);
      if (isOk(outer)) {
        assert.equal(isOk(outer.value), true);
        if (isOk(outer.value)) {
          assert.equal(outer.value.value, 42);
        }
      }
    });

    it("flattens nested Results via chain", () => {
      const nested = ok(ok(42));
      const flattened = chain(nested).flatten();
      assert.equal(flattened.value, 42);
    });

    it("flattens nested Err", () => {
      const nested = ok(err("inner error"));
      const flattened = chain(nested).flatten();
      assert.equal(flattened.error, "inner error");
    });
  });

  describe("Result.collect edge cases", () => {
    it("handles empty array", () => {
      const result = Result.collect([]);
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.deepEqual(result.value, []);
      }
    });

    it("handles single Ok element", () => {
      const result = Result.collect([ok(42)]);
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.deepEqual(result.value, [42]);
      }
    });

    it("handles single Err element", () => {
      const result = Result.collect([err("error")]);
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.equal(result.error, "error");
      }
    });

    it("handles all Err elements", () => {
      const result = Result.collect([err("a"), err("b"), err("c")]);
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.equal(result.error, "a"); // fail-fast returns first
      }
    });
  });

  describe("Result.collectAll edge cases", () => {
    it("handles empty array", () => {
      const result = Result.collectAll([]);
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.deepEqual(result.value, []);
      }
    });

    it("handles all Err elements", () => {
      const result = Result.collectAll([err("a"), err("b"), err("c")]);
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.deepEqual(result.error, ["a", "b", "c"]);
      }
    });
  });

  describe("Result.partition edge cases", () => {
    it("handles empty array", () => {
      const { ok: oks, err: errs } = Result.partition([]);
      assert.deepEqual(oks, []);
      assert.deepEqual(errs, []);
    });

    it("handles all Ok", () => {
      const { ok: oks, err: errs } = Result.partition([ok(1), ok(2), ok(3)]);
      assert.deepEqual(oks, [1, 2, 3]);
      assert.deepEqual(errs, []);
    });

    it("handles all Err", () => {
      const { ok: oks, err: errs } = Result.partition([err("a"), err("b")]);
      assert.deepEqual(oks, []);
      assert.deepEqual(errs, ["a", "b"]);
    });
  });

  describe("Result.fromTry edge cases", () => {
    it("handles non-Error throws (string)", () => {
      const result = Result.fromTry(() => {
        throw "string error";
      });
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.ok(result.error instanceof Error);
        assert.equal(result.error.message, "string error");
      }
    });

    it("handles non-Error throws (number)", () => {
      const result = Result.fromTry(() => {
        throw 42;
      });
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.ok(result.error instanceof Error);
        assert.equal(result.error.message, "42");
      }
    });

    it("handles non-Error throws (object)", () => {
      const result = Result.fromTry(() => {
        throw { code: 404 };
      });
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.ok(result.error instanceof Error);
      }
    });

    it("handles non-Error throws (null)", () => {
      const result = Result.fromTry(() => {
        throw null;
      });
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.ok(result.error instanceof Error);
        assert.equal(result.error.message, "null");
      }
    });

    it("handles non-Error throws (undefined)", () => {
      const result = Result.fromTry(() => {
        throw undefined;
      });
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.ok(result.error instanceof Error);
        assert.equal(result.error.message, "undefined");
      }
    });
  });

  describe("Result.fromAsync edge cases", () => {
    it("handles non-Error rejects (string)", async () => {
      const result = await Result.fromAsync(async () => {
        throw "async string error";
      });
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.ok(result.error instanceof Error);
        assert.equal(result.error.message, "async string error");
      }
    });

    it("handles Promise.reject with non-Error", async () => {
      const result = await Result.fromAsync(() => Promise.reject(123));
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.ok(result.error instanceof Error);
        assert.equal(result.error.message, "123");
      }
    });
  });

  describe("ResultChain long chains", () => {
    it("chains multiple map operations", () => {
      const result = chain(ok(1))
        .map((x) => x + 1)
        .map((x) => x * 2)
        .map((x) => x.toString())
        .map((x) => `${x}!`)
        .toResult();

      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.equal(result.value, "4!");
      }
    });

    it("short-circuits on first Err in chain", () => {
      let mapCalled = false;
      const result = chain(ok(1))
        .map((x) => x + 1)
        .flatMap(() => err("stopped"))
        .map(() => {
          mapCalled = true;
          return 999;
        })
        .toResult();

      assert.equal(!isOk(result), true);
      assert.equal(mapCalled, false);
    });

    it("chains map and mapErr", () => {
      const okResult = chain(ok(10))
        .map((x) => x * 2)
        .mapErr((e) => `Error: ${e}`)
        .toResult();

      const errResult = chain(err<number, string>("failed"))
        .map((x) => x * 2)
        .mapErr((e) => `Error: ${e}`)
        .toResult();

      assert.equal(isOk(okResult), true);
      if (isOk(okResult)) assert.equal(okResult.value, 20);

      assert.equal(!isOk(errResult), true);
      if (!isOk(errResult)) assert.equal(errResult.error, "Error: failed");
    });
  });

  describe("Stream edge cases", () => {
    async function* emptyStream(): ResultStream<number, string> {
      // yields nothing
    }

    async function* singleOkStream(): ResultStream<number, string> {
      yield ok(42);
    }

    async function* singleErrStream(): ResultStream<number, string> {
      yield err("only error");
    }

    it("collectStream handles empty stream", async () => {
      const result = await collectStream(emptyStream());
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.deepEqual(result.value, []);
      }
    });

    it("collectStream handles single Ok", async () => {
      const result = await collectStream(singleOkStream());
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.deepEqual(result.value, [42]);
      }
    });

    it("collectStream handles single Err", async () => {
      const result = await collectStream(singleErrStream());
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.equal(result.error, "only error");
      }
    });

    it("collectStreamAll handles empty stream", async () => {
      const result = await collectStreamAll(emptyStream());
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.deepEqual(result.value, []);
      }
    });
  });
});

describe("Option edge cases", () => {
  describe("some() with special values", () => {
    it("handles undefined value", () => {
      const option = some(undefined);
      assert.equal(option.some, true);
      assert.equal(option.value, undefined);
    });

    it("handles null value", () => {
      const option = some(null);
      assert.equal(option.some, true);
      assert.equal(option.value, null);
    });

    it("handles false value", () => {
      const option = some(false);
      assert.equal(option.some, true);
      assert.equal(option.value, false);
    });

    it("handles 0 value", () => {
      const option = some(0);
      assert.equal(option.some, true);
      assert.equal(option.value, 0);
    });

    it("handles empty string value", () => {
      const option = some("");
      assert.equal(option.some, true);
      assert.equal(option.value, "");
    });

    it("handles NaN value", () => {
      const option = some(NaN);
      assert.equal(option.some, true);
      assert.equal(Number.isNaN(option.value), true);
    });
  });

  describe("nested Options", () => {
    it("handles Option<Option<T>>", () => {
      const inner = some(42);
      const outer = some(inner);
      assert.equal(isSome(outer), true);
      if (isSome(outer)) {
        assert.equal(isSome(outer.value), true);
        if (isSome(outer.value)) {
          assert.equal(outer.value.value, 42);
        }
      }
    });

    it("flattens nested Options via chain", () => {
      const nested = some(some(42));
      const flattened = chainOption(nested).flatten();
      assert.equal(flattened.value, 42);
    });

    it("flattens nested None", () => {
      const nested = some(none<number>());
      const flattened = chainOption(nested).flatten();
      assert.equal(flattened.isNone(), true);
    });

    it("outer None stays None", () => {
      const nested = none<typeof some<number>>();
      // Can't flatten outer None easily, but map should pass through
      const result = chainOption(nested).map((inner) => inner);
      assert.equal(result.isNone(), true);
    });
  });

  describe("filter edge cases", () => {
    it("filter with always-true predicate", () => {
      const result = chainOption(some(42)).filter(() => true);
      assert.equal(result.value, 42);
    });

    it("filter with always-false predicate", () => {
      const result = chainOption(some(42)).filter(() => false);
      assert.equal(result.isNone(), true);
    });

    it("multiple filters", () => {
      const result = chainOption(some(10))
        .filter((x) => x > 5)
        .filter((x) => x < 15)
        .filter((x) => x % 2 === 0);
      assert.equal(result.value, 10);
    });

    it("filter fails mid-chain", () => {
      const result = chainOption(some(10))
        .filter((x) => x > 5)
        .filter((x) => x > 100) // fails here
        .filter((x) => x % 2 === 0);
      assert.equal(result.isNone(), true);
    });
  });

  describe("OptionChain long chains", () => {
    it("chains multiple map operations", () => {
      const result = chainOption(some(1))
        .map((x) => x + 1)
        .map((x) => x * 2)
        .map((x) => x.toString())
        .map((x) => `${x}!`)
        .toOption();

      assert.equal(isSome(result), true);
      if (isSome(result)) {
        assert.equal(result.value, "4!");
      }
    });

    it("short-circuits on None in chain", () => {
      let mapCalled = false;
      const result = chainOption(some(1))
        .map((x) => x + 1)
        .flatMap(() => none<number>())
        .map(() => {
          mapCalled = true;
          return 999;
        })
        .toOption();

      assert.equal(!isSome(result), true);
      assert.equal(mapCalled, false);
    });
  });

  describe("Option to Result conversion edge cases", () => {
    it("converts Some(undefined) to Ok(undefined)", () => {
      const result = chainOption(some(undefined)).toResult("error");
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.equal(result.value, undefined);
      }
    });

    it("converts Some(null) to Ok(null)", () => {
      const result = chainOption(some(null)).toResult("error");
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.equal(result.value, null);
      }
    });

    it("converts None to Err with falsy error", () => {
      const result = chainOption(none()).toResult(0);
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.equal(result.error, 0);
      }
    });
  });

  describe("unwrap edge cases", () => {
    it("unwrapOr with falsy default (0)", () => {
      assert.equal(chainOption(none<number>()).unwrapOr(0), 0);
      assert.equal(chainOption(some(5)).unwrapOr(0), 5);
    });

    it("unwrapOr with falsy default (empty string)", () => {
      assert.equal(chainOption(none<string>()).unwrapOr(""), "");
      assert.equal(chainOption(some("hello")).unwrapOr(""), "hello");
    });

    it("unwrapOr with falsy default (false)", () => {
      assert.equal(chainOption(none<boolean>()).unwrapOr(false), false);
      assert.equal(chainOption(some(true)).unwrapOr(false), true);
    });

    it("unwrapOrElse is not called for Some", () => {
      let called = false;
      chainOption(some(42)).unwrapOrElse(() => {
        called = true;
        return 0;
      });
      assert.equal(called, false);
    });

    it("unwrapOrElse is called for None", () => {
      let called = false;
      chainOption(none<number>()).unwrapOrElse(() => {
        called = true;
        return 0;
      });
      assert.equal(called, true);
    });
  });
});

describe("Type guard narrowing edge cases", () => {
  it("isOk narrows type correctly", () => {
    const result: Result<number, string> = ok(42);
    if (isOk(result)) {
      // TypeScript should know result.value exists here
      const val: number = result.value;
      assert.equal(val, 42);
    }
  });

  it("!isOk narrows type correctly", () => {
    const result: Result<number, string> = err("error");
    if (!isOk(result)) {
      // TypeScript should know result.error exists here
      const e: string = result.error;
      assert.equal(e, "error");
    }
  });

  it("isSome narrows type correctly", () => {
    const option = some(42);
    if (isSome(option)) {
      // TypeScript should know option.value exists here
      const val: number = option.value;
      assert.equal(val, 42);
    }
  });

  it("!isSome narrows to None", () => {
    const option = none<number>();
    if (!isSome(option)) {
      // TypeScript should know this is None
      assert.equal(option.some, false);
    }
  });
});

describe("Serialization edge cases", () => {
  it("ok() is JSON serializable", () => {
    const result = ok({ name: "test", value: 42 });
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    assert.deepEqual(parsed, { ok: true, value: { name: "test", value: 42 } });
  });

  it("err() is JSON serializable", () => {
    const result = err({ code: "ERR_001", message: "Something failed" });
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    assert.deepEqual(parsed, {
      ok: false,
      error: { code: "ERR_001", message: "Something failed" },
    });
  });

  it("some() is JSON serializable", () => {
    const option = some({ data: [1, 2, 3] });
    const json = JSON.stringify(option);
    const parsed = JSON.parse(json);
    assert.deepEqual(parsed, { some: true, value: { data: [1, 2, 3] } });
  });

  it("none() is JSON serializable", () => {
    const option = none();
    const json = JSON.stringify(option);
    const parsed = JSON.parse(json);
    assert.deepEqual(parsed, { some: false });
  });
});
