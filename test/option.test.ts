import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chainOption, isSome, none, some } from "../src/option.js";
import { isOk } from "../src/result.js";

describe("Option constructors", () => {
  it("some() creates a Some option", () => {
    const option = some(42);
    assert.equal(option.some, true);
    assert.equal(option.value, 42);
  });

  it("none() creates a None option", () => {
    const option = none();
    assert.equal(option.some, false);
  });

  it("none() returns singleton", () => {
    assert.strictEqual(none(), none());
  });
});

describe("Type guards", () => {
  it("isSome() returns true for Some", () => {
    assert.equal(isSome(some(42)), true);
  });

  it("isSome() returns false for None", () => {
    assert.equal(isSome(none()), false);
  });

  it("!isSome() returns true for None", () => {
    assert.equal(!isSome(none()), true);
  });

  it("!isSome() returns false for Some", () => {
    assert.equal(!isSome(some(42)), false);
  });
});

describe("OptionChain", () => {
  describe("isSome/isNone", () => {
    it("isSome() returns true for Some", () => {
      assert.equal(chainOption(some(42)).isSome(), true);
      assert.equal(chainOption(some(42)).isNone(), false);
    });

    it("isNone() returns true for None", () => {
      assert.equal(chainOption(none()).isNone(), true);
      assert.equal(chainOption(none()).isSome(), false);
    });
  });

  describe("value accessor", () => {
    it("returns value for Some", () => {
      assert.equal(chainOption(some(42)).value, 42);
    });

    it("throws for None", () => {
      assert.throws(() => chainOption(none()).value, /Cannot access value on None/);
    });
  });

  describe("map", () => {
    it("transforms Some value", () => {
      const result = chainOption(some(2)).map((x) => x * 3);
      assert.equal(result.value, 6);
    });

    it("passes through None", () => {
      const result = chainOption(none<number>()).map((x) => x * 3);
      assert.equal(result.isNone(), true);
    });
  });

  describe("flatMap", () => {
    it("chains Some options", () => {
      const result = chainOption(some(2)).flatMap((x) => some(x * 3));
      assert.equal(result.value, 6);
    });

    it("returns None from function", () => {
      const result = chainOption(some(2)).flatMap(() => none());
      assert.equal(result.isNone(), true);
    });

    it("passes through initial None", () => {
      const result = chainOption(none<number>()).flatMap((x) => some(x * 3));
      assert.equal(result.isNone(), true);
    });
  });

  describe("filter", () => {
    it("keeps Some if predicate passes", () => {
      const result = chainOption(some(10)).filter((x) => x > 5);
      assert.equal(result.value, 10);
    });

    it("converts to None if predicate fails", () => {
      const result = chainOption(some(3)).filter((x) => x > 5);
      assert.equal(result.isNone(), true);
    });

    it("passes through None", () => {
      const result = chainOption(none<number>()).filter((x) => x > 5);
      assert.equal(result.isNone(), true);
    });
  });

  describe("unwrap methods", () => {
    it("unwrap() returns value for Some", () => {
      assert.equal(chainOption(some(42)).unwrap(), 42);
    });

    it("unwrap() throws for None", () => {
      assert.throws(() => chainOption(none()).unwrap(), /Attempted to unwrap None/);
    });

    it("unwrapOr() returns value for Some", () => {
      assert.equal(chainOption(some(42)).unwrapOr(0), 42);
    });

    it("unwrapOr() returns default for None", () => {
      assert.equal(chainOption(none<number>()).unwrapOr(0), 0);
    });

    it("unwrapOrElse() returns value for Some", () => {
      assert.equal(
        chainOption(some(42)).unwrapOrElse(() => 0),
        42,
      );
    });

    it("unwrapOrElse() calls fn for None", () => {
      assert.equal(
        chainOption(none<number>()).unwrapOrElse(() => 99),
        99,
      );
    });
  });

  describe("match", () => {
    it("calls some arm for Some", () => {
      const result = chainOption(some(42)).match({
        some: (v) => `value: ${v}`,
        none: () => "empty",
      });
      assert.equal(result, "value: 42");
    });

    it("calls none arm for None", () => {
      const result = chainOption(none()).match({
        some: (v) => `value: ${v}`,
        none: () => "empty",
      });
      assert.equal(result, "empty");
    });
  });

  describe("and/or combinators", () => {
    it("and() returns other for Some", () => {
      const result = chainOption(some(1)).and(some(2));
      assert.equal(result.value, 2);
    });

    it("and() returns self for None", () => {
      const result = chainOption(none<number>()).and(some(2));
      assert.equal(result.isNone(), true);
    });

    it("or() returns self for Some", () => {
      const result = chainOption(some(1)).or(some(2));
      assert.equal(result.value, 1);
    });

    it("or() returns other for None", () => {
      const result = chainOption(none<number>()).or(some(2));
      assert.equal(result.value, 2);
    });
  });

  describe("toResult", () => {
    it("converts Some to Ok", () => {
      const result = chainOption(some(42)).toResult("error");
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.equal(result.value, 42);
      }
    });

    it("converts None to Err", () => {
      const result = chainOption(none()).toResult("error");
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.equal(result.error, "error");
      }
    });
  });

  describe("toResultChain", () => {
    it("converts Some to ResultChain with Ok", () => {
      const result = chainOption(some(42)).toResultChain("error");
      assert.equal(result.isOk(), true);
      assert.equal(result.value, 42);
    });

    it("converts None to ResultChain with Err", () => {
      const result = chainOption(none()).toResultChain("error");
      assert.equal(result.isErr(), true);
      assert.equal(result.error, "error");
    });
  });

  describe("toOption", () => {
    it("returns plain Option", () => {
      const plain = chainOption(some(42)).toOption();
      assert.equal(plain.some, true);
      if (plain.some) assert.equal(plain.value, 42);
    });
  });
});
