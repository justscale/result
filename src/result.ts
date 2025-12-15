// ============================================================================
// Phantom Brands (compile-time only, not present at runtime)
// ============================================================================

declare const ResultBrand: unique symbol;
declare const OkBrand: unique symbol;
declare const ErrBrand: unique symbol;

// ============================================================================
// Plain Result Types (branded at type-level only)
// ============================================================================

export type Ok<T> = {
  readonly [ResultBrand]: true;
  readonly [OkBrand]: true;
  readonly ok: true;
  readonly value: T;
};

export type Err<E> = {
  readonly [ResultBrand]: true;
  readonly [ErrBrand]: true;
  readonly ok: false;
  readonly error: E;
};

export type Result<T, E> = Ok<T> | Err<E>;

// ============================================================================
// Constructors (plain objects, cast to branded types)
// ============================================================================

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value } as Ok<T>;
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error } as Err<E>;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

// ============================================================================
// ResultChain - Wrapper class for method chaining
// ============================================================================

export class ResultChain<T, E> {
  readonly #data: Result<T, E>;

  private constructor(data: Result<T, E>) {
    this.#data = data;
  }

  /**
   * Wrap a plain Result for method chaining.
   */
  static from<T, E>(result: Result<T, E>): ResultChain<T, E> {
    return new ResultChain(result);
  }

  /**
   * Unwrap back to plain Result.
   */
  toResult(): Result<T, E> {
    return this.#data;
  }

  // -------------------------------------------------------------------------
  // Type Guards
  // -------------------------------------------------------------------------

  isOk(): boolean {
    return this.#data.ok;
  }

  isErr(): boolean {
    return !this.#data.ok;
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  get value(): T {
    if (!this.#data.ok) {
      throw new Error("Cannot access value on Err");
    }
    return this.#data.value;
  }

  get error(): E {
    if (this.#data.ok) {
      throw new Error("Cannot access error on Ok");
    }
    return this.#data.error;
  }

  // -------------------------------------------------------------------------
  // Transformations
  // -------------------------------------------------------------------------

  map<U>(fn: (t: T) => U): ResultChain<U, E> {
    return this.#data.ok
      ? ResultChain.from(ok(fn(this.#data.value)))
      : (this as unknown as ResultChain<U, E>);
  }

  mapErr<F>(fn: (e: E) => F): ResultChain<T, F> {
    return this.#data.ok
      ? (this as unknown as ResultChain<T, F>)
      : ResultChain.from(err(fn(this.#data.error)));
  }

  flatMap<U, F>(fn: (t: T) => Result<U, F>): ResultChain<U, E | F> {
    return this.#data.ok
      ? ResultChain.from(fn(this.#data.value))
      : (this as unknown as ResultChain<U, E | F>);
  }

  flatten<U, F>(this: ResultChain<Result<U, F>, E>): ResultChain<U, E | F> {
    return this.flatMap((inner) => inner);
  }

  // -------------------------------------------------------------------------
  // Unwrapping
  // -------------------------------------------------------------------------

  unwrap(): T {
    if (this.#data.ok) return this.#data.value;
    throw this.#data.error;
  }

  unwrapOr(defaultValue: T): T {
    return this.#data.ok ? this.#data.value : defaultValue;
  }

  unwrapOrElse(fn: (e: E) => T): T {
    return this.#data.ok ? this.#data.value : fn(this.#data.error);
  }

  unwrapErr(): E {
    if (!this.#data.ok) return this.#data.error;
    throw new Error("Called unwrapErr on Ok");
  }

  // -------------------------------------------------------------------------
  // Pattern Matching
  // -------------------------------------------------------------------------

  match<R>(arms: { ok: (value: T) => R; err: (error: E) => R }): R {
    return this.#data.ok ? arms.ok(this.#data.value) : arms.err(this.#data.error);
  }

  // -------------------------------------------------------------------------
  // Combinators
  // -------------------------------------------------------------------------

  and<U>(other: Result<U, E>): ResultChain<U, E> {
    return this.#data.ok ? ResultChain.from(other) : (this as unknown as ResultChain<U, E>);
  }

  or<F>(other: Result<T, F>): ResultChain<T, E | F> {
    return this.#data.ok
      ? (this as unknown as ResultChain<T, E | F>)
      : (ResultChain.from(other) as ResultChain<T, E | F>);
  }
}

// ============================================================================
// Convenience: wrap for chaining
// ============================================================================

export function chain<T, E>(result: Result<T, E>): ResultChain<T, E> {
  return ResultChain.from(result);
}

// ============================================================================
// Accumulated Error Type
// ============================================================================

/**
 * Marker type for accumulated errors.
 * Compile-time distinct from single-error Results.
 */
export type Accumulated<E> = E[] & { readonly __accumulated: true };

// ============================================================================
// Result Namespace
// ============================================================================

export const Result = {
  /**
   * Collect array of Results into Result of array.
   * Returns first error encountered (fail-fast).
   */
  collect<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    for (const result of results) {
      if (!isOk(result)) return result as unknown as Result<T[], E>;
      values.push(result.value);
    }
    return ok(values);
  },

  /**
   * Collect array of Results, accumulating ALL errors.
   * Returns Accumulated<E> which is type-distinct from E[].
   */
  collectAll<T, E>(results: Result<T, E>[]): Result<T[], Accumulated<E>> {
    const values: T[] = [];
    const errors: E[] = [];

    for (const result of results) {
      if (!isOk(result)) {
        errors.push(result.error);
      } else {
        values.push(result.value);
      }
    }

    return errors.length > 0 ? err(errors as Accumulated<E>) : ok(values);
  },

  /**
   * Partition results into successes and failures.
   * Unlike collect/collectAll, this never fails - just separates.
   */
  partition<T, E>(results: Result<T, E>[]): { ok: T[]; err: E[] } {
    const okValues: T[] = [];
    const errValues: E[] = [];

    for (const result of results) {
      if (isOk(result)) {
        okValues.push(result.value);
      } else {
        errValues.push(result.error);
      }
    }

    return { ok: okValues, err: errValues };
  },

  /**
   * Wrap an async function that might throw into a Result.
   */
  async fromAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
    try {
      return ok(await fn());
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  },

  /**
   * Wrap a sync function that might throw into a Result.
   */
  fromTry<T>(fn: () => T): Result<T, Error> {
    try {
      return ok(fn());
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  },
} as const;

// ============================================================================
// Stream Types and Utilities
// ============================================================================

export type ResultStream<T, E> = AsyncGenerator<Result<T, E>, void, unknown>;

/**
 * Helper to iterate a ResultStream, stopping on first error.
 */
export async function* takeUntilErr<T, E>(
  stream: ResultStream<T, E>,
): AsyncGenerator<T, Result<void, E>, unknown> {
  for await (const result of stream) {
    if (!isOk(result)) {
      return result as unknown as Result<void, E>;
    }
    yield result.value;
  }
  return ok(undefined);
}

/**
 * Collect all successful values from stream until first error.
 */
export async function collectStream<T, E>(stream: ResultStream<T, E>): Promise<Result<T[], E>> {
  const values: T[] = [];
  for await (const result of stream) {
    if (!isOk(result)) {
      return result as unknown as Result<T[], E>;
    }
    values.push(result.value);
  }
  return ok(values);
}

/**
 * Collect all results from stream, accumulating errors.
 */
export async function collectStreamAll<T, E>(
  stream: ResultStream<T, E>,
): Promise<Result<T[], Accumulated<E>>> {
  const values: T[] = [];
  const errors: E[] = [];

  for await (const result of stream) {
    if (!isOk(result)) {
      errors.push(result.error);
    } else {
      values.push(result.value);
    }
  }

  return errors.length > 0 ? err(errors as Accumulated<E>) : ok(values);
}
