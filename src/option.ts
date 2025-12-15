import { err, ok, type Result } from "./result.js";

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
// Option Namespace
// ============================================================================

export const Option = {
  /**
   * Get the value from an Option, or return a default if None.
   */
  someOr<T, U>(option: Option<T>, defaultValue: U): T | U {
    return isSome(option) ? option.value : defaultValue;
  },

  /**
   * Convert an Option to a Result.
   */
  toResult<T, E>(option: Option<T>, error: E): Result<T, E> {
    return isSome(option) ? ok(option.value) : err(error);
  },
} as const;
