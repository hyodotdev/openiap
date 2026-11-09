import { expect, it } from "vitest";
import {
  appleConformanceMethods,
  assertAppleConformanceRun,
} from "../scripts/check-apple-test-run.mjs";

const methods = appleConformanceMethods(`
    func testErrors() {}
  func testStore() throws {}
`);

it("discovers XCTest methods at any indentation and with modifiers", () => {
  expect(methods).toEqual(["testErrors", "testStore"]);
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
      [result("testErrors", "passed"), result("testStore", "passed")].join(
        "\n",
      ),
    ),
  ).not.toThrow();
});

it.each(["skipped", "missing", "duplicated"])(
  "rejects an Apple behavior test that is %s",
  (status) => {
    const passed = result("testStore", "passed");
    const store =
      status === "missing"
        ? ""
        : status === "duplicated"
          ? `${passed}\n${passed}`
          : result("testStore", status);
    expect(() =>
      assertAppleConformanceRun(
        methods,
        `${result("testErrors", "passed")}\n${store}`,
      ),
    ).toThrow(/testStore/);
  },
);
