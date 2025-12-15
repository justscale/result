# @justscale/result

A lightweight, type-safe Result and Option implementation for TypeScript.

## Features

- **Plain branded objects** - `ok()` and `err()` return lightweight, JSON-serializable objects
- **Phantom type brands** - Compile-time safety without runtime overhead
- **Both fail-fast and accumulating collect** - with compile-time type distinction (`Accumulated<E>`)
- **Generator/stream support** - `ResultStream<T, E>` for async iteration
- **Zero dependencies** - Just TypeScript

## Installation

```bash
npm install @justscale/result
# or
pnpm add @justscale/result
# or
yarn add @justscale/result
```

## Quick Start

```typescript
import { ok, err, isOk, Result } from "@justscale/result";

// Create results
const success = ok(42);
const failure = err("something went wrong");

// Type guard narrowing
if (isOk(success)) {
  console.log(success.value); // 42
}

if (!isOk(failure)) {
  console.log(failure.error); // "something went wrong"
}

// Get value with default
const value = Result.okOr(failure, 0); // 0
```

## API Reference

### Result Types

```typescript
type Ok<T> = { readonly ok: true; readonly value: T };
type Err<E> = { readonly ok: false; readonly error: E };
type Result<T, E> = Ok<T> | Err<E>;
```

### Constructors

#### `ok<T>(value: T): Ok<T>`

Creates a successful result containing `value`.

```typescript
const result = ok(42);
// { ok: true, value: 42 }
```

#### `err<E>(error: E): Err<E>`

Creates a failed result containing `error`.

```typescript
const result = err("not found");
// { ok: false, error: "not found" }
```

### Type Guards

#### `isOk<T, E>(result: Result<T, E>): result is Ok<T>`

Returns `true` if the result is `Ok`, narrowing the type.

```typescript
const result: Result<number, string> = ok(42);

if (isOk(result)) {
  // TypeScript knows result.value exists
  console.log(result.value);
} else {
  // TypeScript knows result.error exists
  console.log(result.error);
}
```

> **Note:** There is no `isErr` function. Use `!isOk(result)` instead.

### Result Namespace

Static utility functions for working with Results.

#### `Result.okOr<T, E, U>(result: Result<T, E>, defaultValue: U): T | U`

Get the value from a Result, or return a default if Err.

```typescript
const success = ok(42);
const failure = err("error");

Result.okOr(success, 0); // 42
Result.okOr(failure, 0); // 0
```

#### `Result.collect<T, E>(results: Result<T, E>[]): Result<T[], E>`

Collect an array of Results into a Result of array. **Fail-fast**: returns the first error encountered.

```typescript
const results = [ok(1), ok(2), ok(3)];
const collected = Result.collect(results);
// { ok: true, value: [1, 2, 3] }

const withError = [ok(1), err("oops"), ok(3)];
const failed = Result.collect(withError);
// { ok: false, error: "oops" }
```

#### `Result.collectAll<T, E>(results: Result<T, E>[]): Result<T[], Accumulated<E>>`

Collect an array of Results, **accumulating all errors**. Returns `Accumulated<E>` which is type-distinct from `E[]`.

```typescript
const results = [ok(1), err("a"), ok(2), err("b")];
const collected = Result.collectAll(results);
// { ok: false, error: ["a", "b"] }
```

#### `Result.partition<T, E>(results: Result<T, E>[]): { ok: T[]; err: E[] }`

Partition results into successes and failures. Never fails.

```typescript
const results = [ok(1), err("a"), ok(2), err("b")];
const { ok: successes, err: failures } = Result.partition(results);
// successes: [1, 2]
// failures: ["a", "b"]
```

#### `Result.fromTry<T>(fn: () => T): Result<T, Error>`

Wrap a synchronous function that might throw.

```typescript
const result = Result.fromTry(() => JSON.parse(input));
```

#### `Result.fromAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>>`

Wrap an async function that might throw.

```typescript
const result = await Result.fromAsync(() => fetch("/api/data").then((r) => r.json()));
```

### Stream Utilities

For working with async generators of Results.

#### `ResultStream<T, E>`

```typescript
type ResultStream<T, E> = AsyncGenerator<Result<T, E>, void, unknown>;
```

#### `collectStream<T, E>(stream: ResultStream<T, E>): Promise<Result<T[], E>>`

Collect all successful values until the first error.

#### `collectStreamAll<T, E>(stream: ResultStream<T, E>): Promise<Result<T[], Accumulated<E>>>`

Collect all results, accumulating errors.

#### `takeUntilErr<T, E>(stream: ResultStream<T, E>): AsyncGenerator<T, Result<void, E>, unknown>`

Iterate yielding values until an error is encountered.

```typescript
async function* fetchPages(): ResultStream<Page, Error> {
  for (let i = 1; i <= 10; i++) {
    const result = await Result.fromAsync(() => fetchPage(i));
    yield result;
  }
}

// Collect all or fail on first error
const allPages = await collectStream(fetchPages());

// Or iterate with early termination
for await (const page of takeUntilErr(fetchPages())) {
  process.stdout.write(`Processing page ${page.id}...`);
}
```

---

## Option Type

For representing optional values without `null` or `undefined`.

### Option Types

```typescript
type Some<T> = { readonly some: true; readonly value: T };
type None = { readonly some: false };
type Option<T> = Some<T> | None;
```

### Constructors

#### `some<T>(value: T): Some<T>`

```typescript
const option = some(42);
// { some: true, value: 42 }
```

#### `none<T = never>(): Option<T>`

```typescript
const option = none();
// { some: false }
```

> **Note:** `none()` returns a singleton instance for memory efficiency.

### Type Guards

#### `isSome<T>(option: Option<T>): option is Some<T>`

```typescript
const option: Option<number> = some(42);

if (isSome(option)) {
  console.log(option.value); // 42
}
```

> **Note:** There is no `isNone` function. Use `!isSome(option)` instead.

### Option Namespace

Static utility functions for working with Options.

#### `Option.someOr<T, U>(option: Option<T>, defaultValue: U): T | U`

Get the value from an Option, or return a default if None.

```typescript
const present = some(42);
const absent = none<number>();

Option.someOr(present, 0); // 42
Option.someOr(absent, 0);  // 0
```

#### `Option.toResult<T, E>(option: Option<T>, error: E): Result<T, E>`

Convert an Option to a Result.

```typescript
const token: Option<string> = getAuthToken();
const result = Option.toResult(token, "Missing token");
// Ok<string> if Some, Err<"Missing token"> if None
```

---

## Design Philosophy

### Plain Objects Over Classes

Results and Options are plain objects with type brands, not class instances. This means:

- **JSON serializable** - Send over the wire, store in databases
- **No prototype chain** - Minimal memory footprint
- **Structural typing** - Works with any object matching the shape

```typescript
// These are equivalent
const a = ok(42);
const b = { ok: true, value: 42 } as Ok<number>;
JSON.stringify(a) === JSON.stringify(b); // true
```

### Type-Level Error Accumulation

`Accumulated<E>` is branded at the type level to distinguish accumulated errors from single errors:

```typescript
type Accumulated<E> = E[] & { readonly __accumulated: true };

// These have different types
const single: Result<User[], ValidationError> = Result.collect(results);
const accumulated: Result<User[], Accumulated<ValidationError>> = Result.collectAll(results);
```

---

## Examples

### API Request with Error Handling

```typescript
import { ok, err, isOk, Result } from "@justscale/result";

interface User {
  id: string;
  name: string;
}

interface ApiError {
  code: number;
  message: string;
}

async function fetchUser(id: string): Promise<Result<User, ApiError>> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      return err({ code: response.status, message: response.statusText });
    }
    return ok(await response.json());
  } catch (e) {
    return err({ code: 0, message: e instanceof Error ? e.message : "Unknown error" });
  }
}

// Usage
const result = await fetchUser("123");

if (isOk(result)) {
  console.log(`Hello, ${result.value.name}!`);
} else {
  console.error(`Error ${result.error.code}: ${result.error.message}`);
}
```

### Form Validation

```typescript
import { ok, err, isOk, Result } from "@justscale/result";

interface FormData {
  email: string;
  password: string;
  age: number;
}

function validateEmail(email: string): Result<string, string> {
  return email.includes("@") ? ok(email) : err("Invalid email format");
}

function validatePassword(password: string): Result<string, string> {
  return password.length >= 8 ? ok(password) : err("Password must be at least 8 characters");
}

function validateAge(age: number): Result<number, string> {
  return age >= 18 ? ok(age) : err("Must be 18 or older");
}

function validateForm(data: FormData): Result<FormData, string[]> {
  const results = [
    validateEmail(data.email),
    validatePassword(data.password),
    validateAge(data.age),
  ];

  const collected = Result.collectAll(results);

  if (!isOk(collected)) {
    return err(collected.error as string[]);
  }

  return ok(data);
}
```

### Optional Configuration

```typescript
import { some, none, isSome, Option } from "@justscale/result";

interface Config {
  apiKey?: string;
  timeout?: number;
  retries?: number;
}

function getConfig(): Option<Config> {
  const raw = localStorage.getItem("config");
  if (!raw) return none();

  try {
    return some(JSON.parse(raw));
  } catch {
    return none();
  }
}

const config = getConfig();
const timeout = isSome(config) && config.value.timeout !== undefined
  ? config.value.timeout
  : 5000;
```

---

## Requirements

- Node.js >= 20.0.0
- TypeScript >= 5.0 (for best type inference)

## License

MIT
