import { expect, it } from "vitest";
import {
  appleConformanceMethods,
  assertAppleConformanceRun,
} from "../scripts/check-apple-test-run.mjs";

const methods = appleConformanceMethods(`
    func testErrors() {}
  func testStore() throws {}
    func test_restore() {}
`);

it("discovers XCTest methods at any indentation and with modifiers", () => {
  expect(methods).toEqual(["testErrors", "testStore", "test_restore"]);
  expect(
    appleConformanceMethods(
      "\tfunc testTab() {}\n    @MainActor final func testActor() async throws {}\n    @available(iOS 15, *) nonisolated func testAvailable() {}\n    static func testStatic() {}",
    ),
  ).toEqual(["testTab", "testActor", "testAvailable"]);
  expect(
    appleConformanceMethods(
      "    func testHelper(_ value: Int) {}\n    /* func testCommented() {} */\n    // func testLine() {}\n    func testReal() {}",
    ),
  ).toEqual(["testReal"]);
});

it("rejects a case XCTest ran that discovery did not declare", () => {
  expect(() =>
    assertAppleConformanceRun(
      methods,
      [
        result("testErrors", "passed"),
        result("testStore", "passed"),
        result("test_restore", "passed"),
        result("testHidden", "skipped"),
      ].join("\n"),
    ),
  ).toThrow(/testHidden/);
});

const result = (name, status) =>
  `Test Case '-[OpenIapTests.StoreConformanceTests ${name}]' ${status} (0.001 seconds).`;

it("requires all discovered Apple behavior tests to pass", () => {
  expect(() =>
    assertAppleConformanceRun(
      methods,
      [
        result("testErrors", "passed"),
        result("testStore", "passed"),
        result("test_restore", "passed"),
      ].join("\n"),
    ),
  ).not.toThrow();
});

it.each([
  ["testStore", "skipped"],
  ["testStore", "missing"],
  ["testStore", "duplicated"],
  // A lowercase suffix is still an XCTest method.
  ["test_restore", "missing"],
])("rejects Apple behavior test %s when it is %s", (name, status) => {
  const passed = result(name, "passed");
  const outcome =
    status === "missing"
      ? ""
      : status === "duplicated"
        ? `${passed}\n${passed}`
        : result(name, status);
  const others = methods
    .filter((method) => method !== name)
    .map((method) => result(method, "passed"));
  expect(() =>
    assertAppleConformanceRun(methods, [...others, outcome].join("\n")),
  ).toThrow(new RegExp(name));
});
