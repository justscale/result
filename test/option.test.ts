import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSome, none, Option, some } from "../src/option.js";
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

describe("Option namespace", () => {
  describe("someOr", () => {
    it("returns value for Some", () => {
      assert.equal(Option.someOr(some(42), 0), 42);
    });

    it("returns default for None", () => {
      assert.equal(Option.someOr(none<number>(), 0), 0);
    });

    it("returns different type default", () => {
      const result = Option.someOr(none<number>(), "default");
      assert.equal(result, "default");
    });

    it("handles falsy values correctly", () => {
      assert.equal(Option.someOr(some(0), 99), 0);
      assert.equal(Option.someOr(some(false), true), false);
      assert.equal(Option.someOr(some(""), "default"), "");
    });
  });

  describe("toResult", () => {
    it("converts Some to Ok", () => {
      const result = Option.toResult(some(42), "error");
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.equal(result.value, 42);
      }
    });

    it("converts None to Err", () => {
      const result = Option.toResult(none(), "missing value");
      assert.equal(!isOk(result), true);
      if (!isOk(result)) {
        assert.equal(result.error, "missing value");
      }
    });

    it("preserves falsy values in Some", () => {
      const result = Option.toResult(some(0), "error");
      assert.equal(isOk(result), true);
      if (isOk(result)) {
        assert.equal(result.value, 0);
      }
    });
  });
});
