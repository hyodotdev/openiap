/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

vi.mock("@/convex", () => ({
  HarmonizedPurchaseState: { ENTITLED: "ENTITLED", UNKNOWN: "UNKNOWN" },
}));

import { PurchasesTable } from "./PurchasesTable";

const noop = () => {};

function renderTable(environments: Array<string | undefined>) {
  render(
    <PurchasesTable
      purchases={environments.map((environment, index) => ({
        _id: `purchase-${index}`,
        store: "apple",
        environment,
        productId: index === 0 ? "premium_monthly" : undefined,
        isValid: true,
        _creationTime: 0,
      }))}
      isLoading={false}
      hasPrev={false}
      hasNext={false}
      onPrevPage={noop}
      onNextPage={noop}
      pageSize={25}
      orgSlug="acme"
      projectSlug="martie"
      navigate={vi.fn()}
      searchQuery=""
      sortField="_creationTime"
      sortDirection="desc"
      onSortChange={noop}
    />,
  );
}

describe("PurchasesTable", () => {
  afterEach(cleanup);

  it("tells sandbox from production and says when the store reported neither", () => {
    renderTable(["Sandbox", "Production", undefined]);

    const column = screen
      .getAllByRole("columnheader")
      .findIndex((header) => header.textContent === "Environment");
    const cells = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[column].textContent);
    expect(cells).toEqual(["Sandbox", "Production", "Not reported"]);
  });

  it("says when the store returned no product, with the reason on hover", () => {
    renderTable(["Production", "Production"]);

    const [withProduct, without] = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[4]);
    expect(withProduct.textContent).toBe("premium_monthly");
    expect(without.textContent).toBe("Not reported");

    fireEvent.mouseEnter(
      within(without).getByText("Not reported").parentElement!,
    );
    expect(screen.getByRole("tooltip").textContent).toMatch(
      /returned no product/,
    );
  });

  it("names the store when its icon is hovered", () => {
    renderTable(["Production"]);

    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseEnter(screen.getByLabelText("App Store").parentElement!);
    expect(screen.getByRole("tooltip").textContent).toBe("App Store");
  });
});
