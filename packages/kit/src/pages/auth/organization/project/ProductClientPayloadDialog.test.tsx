/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  ProductClientPayloadDialog,
  type ClientPayloadProduct,
  type RemoveClientPayloadInput,
  type SaveClientPayloadInput,
} from "./ProductClientPayloadDialog";

const EXISTING_PRODUCT: ClientPayloadProduct = {
  productId: "premium_monthly",
  platform: "IOS",
  title: "Premium Monthly",
  expectedVersion: 4,
  clientPayload: {
    format: "toml",
    body: "max_items = 10",
    version: 4,
    updatedAt: 1_720_000_000_000,
  },
};

afterEach(() => cleanup());

function renderDialog({
  product = EXISTING_PRODUCT,
  onClose = vi.fn(),
  onSave = vi.fn().mockResolvedValue(undefined),
  onRemove = vi.fn().mockResolvedValue(undefined),
}: {
  product?: ClientPayloadProduct;
  onClose?: () => void;
  onSave?: (input: SaveClientPayloadInput) => Promise<void>;
  onRemove?: (input: RemoveClientPayloadInput) => Promise<void>;
} = {}) {
  render(
    <ProductClientPayloadDialog
      isOpen
      product={product}
      onClose={onClose}
      onSave={onSave}
      onRemove={onRemove}
    />,
  );
  return { onClose, onSave, onRemove };
}

describe("ProductClientPayloadDialog", () => {
  it("exposes accessible controls and preloads the existing payload", () => {
    renderDialog();

    expect(
      screen.getByRole("dialog", {
        name: "Edit client payload for premium_monthly on iOS",
      }),
    ).not.toBeNull();
    expect(screen.getByLabelText<HTMLSelectElement>("Format").value).toBe(
      "toml",
    );
    expect(
      screen.getByLabelText<HTMLTextAreaElement>("Payload body").value,
    ).toBe("max_items = 10");
    expect(screen.getByText(/public app data/i)).not.toBeNull();
    expect(screen.getByText(/Version 4/)).not.toBeNull();
  });

  it("keeps focus in the editor while typing across reactive renders", async () => {
    const user = userEvent.setup();
    renderDialog();

    const body = screen.getByLabelText<HTMLTextAreaElement>("Payload body");
    await user.clear(body);
    await user.type(body, "max_items = 12");

    expect(body.value).toBe("max_items = 12");
    expect(document.activeElement).toBe(body);
  });

  it("moves focus to the safe action when removal confirmation opens", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Remove payload" }));

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Keep payload" }),
    );

    await user.click(screen.getByRole("button", { name: "Keep payload" }));

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Remove payload" }),
    );
  });

  it("returns forward Tab focus to the first control when focus is outside", () => {
    renderDialog();
    const outside = document.createElement("button");
    document.body.prepend(outside);
    outside.focus();

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(screen.getByLabelText("Format"));
    outside.remove();
  });

  it("wraps a maximum-length product ID inside the dialog header", () => {
    const productId = "p".repeat(256);
    renderDialog({ product: { ...EXISTING_PRODUCT, productId } });

    expect(screen.getByText(productId).classList.contains("break-all")).toBe(
      true,
    );
  });

  it("keeps aria references valid for product IDs with whitespace", () => {
    renderDialog({
      product: {
        ...EXISTING_PRODUCT,
        productId: "premium monthly/#1",
      },
    });

    const describedBy = screen
      .getByLabelText("Payload body")
      .getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    for (const id of describedBy?.split(/\s+/) ?? []) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("saves the selected product, platform, format, body, and expected version", async () => {
    const user = userEvent.setup();
    const { onClose, onSave } = renderDialog();

    await user.selectOptions(screen.getByLabelText("Format"), "json");
    const body = screen.getByLabelText("Payload body");
    fireEvent.change(body, { target: { value: '{"maxItems":12}' } });
    await user.click(screen.getByRole("button", { name: "Save payload" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        productId: "premium_monthly",
        platform: "IOS",
        format: "json",
        body: '{"maxItems":12}',
        expectedVersion: 4,
      });
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("rejects non-object JSON and keeps Save disabled", async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();

    await user.selectOptions(screen.getByLabelText("Format"), "json");
    const body = screen.getByLabelText("Payload body");
    fireEvent.change(body, { target: { value: "[]" } });

    expect(
      screen.getByText(
        "JSON payload must be an object, not an array or scalar.",
      ),
    ).not.toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Save payload",
      }).disabled,
    ).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("preserves the draft and reports an error when saving fails", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("Version conflict"));
    const { onClose } = renderDialog({ onSave });

    const body = screen.getByLabelText("Payload body");
    fireEvent.change(body, { target: { value: "max_items = 12" } });
    await user.click(screen.getByRole("button", { name: "Save payload" }));

    expect(await screen.findByText("Version conflict")).not.toBeNull();
    expect(
      screen.getByLabelText<HTMLTextAreaElement>("Payload body").value,
    ).toBe("max_items = 12");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("requires an explicit confirmation before removing the payload", async () => {
    const user = userEvent.setup();
    const { onClose, onRemove } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Remove payload" }));
    expect(onRemove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm remove" }));

    await waitFor(() => {
      expect(onRemove).toHaveBeenCalledWith({
        productId: "premium_monthly",
        platform: "IOS",
        expectedVersion: 4,
      });
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the payload editor open and reports a failed removal", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn().mockRejectedValue({
      data: { message: "Client payload was changed by another request" },
    });
    const { onClose } = renderDialog({ onRemove });

    await user.click(screen.getByRole("button", { name: "Remove payload" }));
    await user.click(screen.getByRole("button", { name: "Confirm remove" }));

    expect(
      await screen.findByText("Client payload was changed by another request"),
    ).not.toBeNull();
    expect(
      screen.getByRole("dialog", {
        name: "Edit client payload for premium_monthly on iOS",
      }),
    ).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("creates a new payload guarded by expected version zero", async () => {
    const user = userEvent.setup();
    const product: ClientPayloadProduct = {
      productId: "coins_100",
      platform: "Android",
      title: "100 Coins",
      expectedVersion: 0,
    };
    const { onSave } = renderDialog({ product });

    await user.selectOptions(screen.getByLabelText("Format"), "text");
    fireEvent.change(screen.getByLabelText("Payload body"), {
      target: { value: "coins=100" },
    });
    await user.click(screen.getByRole("button", { name: "Save payload" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        productId: "coins_100",
        platform: "Android",
        format: "text",
        body: "coins=100",
        expectedVersion: 0,
      });
    });
  });

  it("recreates a removed payload with its durable tombstone revision", async () => {
    const user = userEvent.setup();
    const product: ClientPayloadProduct = {
      productId: "coins_100",
      platform: "Android",
      title: "100 Coins",
      expectedVersion: 2,
    };
    const { onSave } = renderDialog({ product });

    await user.selectOptions(screen.getByLabelText("Format"), "text");
    fireEvent.change(screen.getByLabelText("Payload body"), {
      target: { value: "coins=100" },
    });
    await user.click(screen.getByRole("button", { name: "Save payload" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        productId: "coins_100",
        platform: "Android",
        format: "text",
        body: "coins=100",
        expectedVersion: 2,
      });
    });
  });
});
