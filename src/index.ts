// Option
export {
  isSome,
  type None,
  none,
  type Option,
  Option as OptionNS,
  type Some,
  some,
} from "./option.js";

// Result
export {
  type Accumulated,
  collectStream,
  collectStreamAll,
  type Err,
  err,
  isOk,
  type Ok,
  ok,
  type Result,
  Result as ResultNS,
  type ResultStream,
  takeUntilErr,
} from "./result.js";
