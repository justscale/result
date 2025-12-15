import { err, ok, type Result, ResultChain } from "./result.js";

// ============================================================================
// Phantom Brands (compile-time only, not present at runtime)
// ============================================================================

declare const OptionBrand: unique symbol;
declare const SomeBrand: unique symbol;
declare const NoneBrand: unique symbol;

// ============================================================================
// Plain Option Types (branded at type-level only)
// ============================================================================

export type Some<T> = {
  readonly [OptionBrand]: true;
  readonly [SomeBrand]: true;
  readonly some: true;
  readonly value: T;
};

export type None = {
  readonly [OptionBrand]: true;
  readonly [NoneBrand]: true;
  readonly some: false;
};

export type Option<T> = Some<T> | None;

// ============================================================================
// Constructors (plain objects, cast to branded types)
// ============================================================================

export function some<T>(value: T): Some<T> {
  return { some: true, value } as Some<T>;
}

// Singleton None instance
const NONE = { some: false } as None;

export function none<T = never>(): Option<T> {
  return NONE as Option<T>;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isSome<T>(option: Option<T>): option is Some<T> {
  return option.some === true;
}

// ============================================================================
// OptionChain - Wrapper class for method chaining
// ============================================================================

export class OptionChain<T> {
  readonly #data: Option<T>;

  private constructor(data: Option<T>) {
    this.#data = data;
  }

  /**
   * Wrap a plain Option for method chaining.
   */
  static from<T>(option: Option<T>): OptionChain<T> {
    return new OptionChain(option);
  }

  /**
   * Unwrap back to plain Option.
   */
  toOption(): Option<T> {
    return this.#data;
  }

  // -------------------------------------------------------------------------
  // Type Guards
  // -------------------------------------------------------------------------

  isSome(): boolean {
    return this.#data.some;
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  get value(): T {
    if (!this.#data.some) {
      throw new Error("Cannot access value on None");
    }
    return this.#data.value;
  }

  // -------------------------------------------------------------------------
  // Transformations
  // -------------------------------------------------------------------------

  map<U>(fn: (t: T) => U): OptionChain<U> {
    return this.#data.some
      ? OptionChain.from(some(fn(this.#data.value)))
      : (this as unknown as OptionChain<U>);
  }

  flatMap<U>(fn: (t: T) => Option<U>): OptionChain<U> {
    return this.#data.some
      ? OptionChain.from(fn(this.#data.value))
      : (this as unknown as OptionChain<U>);
  }

  flatten<U>(this: OptionChain<Option<U>>): OptionChain<U> {
    return this.flatMap((inner) => inner);
  }

  filter(predicate: (t: T) => boolean): OptionChain<T> {
    return this.#data.some && predicate(this.#data.value) ? this : OptionChain.from(none());
  }

  // -------------------------------------------------------------------------
  // Unwrapping
  // -------------------------------------------------------------------------

  unwrap(): T {
    if (this.#data.some) return this.#data.value;
    throw new Error("Attempted to unwrap None");
  }

  unwrapOr(defaultValue: T): T {
    return this.#data.some ? this.#data.value : defaultValue;
  }

  unwrapOrElse(fn: () => T): T {
    return this.#data.some ? this.#data.value : fn();
  }

  // -------------------------------------------------------------------------
  // Pattern Matching
  // -------------------------------------------------------------------------

  match<R>(arms: { some: (value: T) => R; none: () => R }): R {
    return this.#data.some ? arms.some(this.#data.value) : arms.none();
  }

  // -------------------------------------------------------------------------
  // Combinators
  // -------------------------------------------------------------------------

  or(other: Option<T>): OptionChain<T> {
    return this.#data.some ? this : OptionChain.from(other);
  }

  and<U>(other: Option<U>): OptionChain<U> {
    return this.#data.some ? OptionChain.from(other) : (this as unknown as OptionChain<U>);
  }

  // -------------------------------------------------------------------------
  // Conversion
  // -------------------------------------------------------------------------

  toResult<E>(error: E): Result<T, E> {
    return this.#data.some ? ok(this.#data.value) : err(error);
  }

  toResultChain<E>(error: E): ResultChain<T, E> {
    return ResultChain.from(this.toResult(error));
  }
}

// ============================================================================
// Convenience: wrap for chaining
// ============================================================================

export function chainOption<T>(option: Option<T>): OptionChain<T> {
  return OptionChain.from(option);
}
