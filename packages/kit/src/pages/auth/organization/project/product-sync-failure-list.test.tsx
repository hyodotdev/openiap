/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProductSyncFailureList } from "./product-sync-failure-list";

afterEach(cleanup);

describe("ProductSyncFailureList", () => {
  it("renders every persisted product failure", () => {
    render(
      <ProductSyncFailureList
        failures={[
          { productId: "coins.100", reason: "App Store Connect rejected it" },
          { productId: "premium.monthly", reason: "Price is missing" },
        ]}
      />,
    );

    const failures = within(
      screen.getByRole("list", { name: "Sync failures" }),
    );
    const items = failures.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toBe(
      "coins.100: App Store Connect rejected it",
    );
    expect(items[1]?.textContent).toBe("premium.monthly: Price is missing");
  });

  it("omits the list when the completed job has no failures", () => {
    render(<ProductSyncFailureList failures={[]} />);

    expect(screen.queryByRole("list", { name: "Sync failures" })).toBeNull();
  });
});
