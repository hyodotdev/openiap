import type {
  RegisteredAction,
  RegisteredMutation,
  RegisteredQuery,
} from "convex/server";

type RegisteredFunctionHandler<T> =
  T extends RegisteredQuery<infer _Visibility, infer Args, infer Returns>
    ? (ctx: unknown, args: Args) => Returns
    : T extends RegisteredMutation<infer _Visibility, infer Args, infer Returns>
      ? (ctx: unknown, args: Args) => Returns
      : T extends RegisteredAction<infer _Visibility, infer Args, infer Returns>
        ? (ctx: unknown, args: Args) => Returns
        : never;

type TestableRegisteredFunction<T> = T & {
  _handler: RegisteredFunctionHandler<T>;
};

/**
 * Restore Convex's runtime-only handler seam for focused unit tests.
 *
 * Convex deliberately strips `_handler` from some published declarations, even
 * though registered queries, mutations, and actions retain it at runtime.
 * Keeping the assertion here makes that test-only dependency explicit while
 * preserving each function's validated argument and return types.
 */
function assertHasTestHandler<T>(
  registeredFunction: T,
): asserts registeredFunction is TestableRegisteredFunction<T> {
  const candidate = registeredFunction as { _handler?: unknown };
  if (typeof candidate._handler !== "function") {
    throw new TypeError("Registered Convex function has no test handler");
  }
}

export function testableFunction<T>(
  registeredFunction: T,
): TestableRegisteredFunction<T> {
  assertHasTestHandler(registeredFunction);
  return registeredFunction;
}
