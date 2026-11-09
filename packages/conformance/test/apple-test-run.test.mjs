import { expect, it } from "vitest";
import {
  appleConformanceMethods,
  assertAppleConformanceRun,
} from "../scripts/check-apple-test-run.mjs";

const methods = appleConformanceMethods(`
    func testErrors() {}
    func testStore() throws {}
`);

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
