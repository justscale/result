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

  /**
   * Get the value from a Result, or return a default if Err.
   */
  okOr<T, E, U>(result: Result<T, E>, defaultValue: U): T | U {
    return isOk(result) ? result.value : defaultValue;
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
