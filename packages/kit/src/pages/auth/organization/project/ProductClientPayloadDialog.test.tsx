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
import type { ComponentProps } from "react";

import {
  ProductClientPayloadDialog,
  type ClientPayloadProduct,
} from "./ProductClientPayloadDialog";

const EXISTING_PRODUCT: ClientPayloadProduct = {
  productId: "premium_monthly",
  platform: "IOS",
  title: "Premium Monthly",
  expectedVersion: 4,
  expectedDraftRevision: 0,
  clientPayload: {
    format: "toml",
    body: "max_items = 10",
    version: 4,
    updatedAt: 1_720_000_000_000,
  },
};

type DialogProps = ComponentProps<typeof ProductClientPayloadDialog>;

afterEach(() => cleanup());

function renderDialog(overrides: Partial<DialogProps> = {}) {
  const props: DialogProps = {
    isOpen: true,
    product: EXISTING_PRODUCT,
    onClose: vi.fn(),
    onSaveDraft: vi.fn().mockResolvedValue({ revision: 1, baseVersion: 4 }),
    onPublish: vi.fn().mockResolvedValue(undefined),
    onDiscardDraft: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn().mockResolvedValue(undefined),
    onRollback: vi.fn().mockResolvedValue(undefined),
    tab: "preview",
    onTabChange: vi.fn(),
    sdkPreview: undefined,
    history: undefined,
    selectedVersionDetail: undefined,
    onSelectVersion: vi.fn(),
    ...overrides,
  };
  const view = render(<ProductClientPayloadDialog {...props} />);
  return { ...props, view };
}

function editBody(value: string): void {
  fireEvent.change(screen.getByLabelText("Payload body"), {
    target: { value },
  });
}

function button(name: string): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>("button", { name });
}

describe("ProductClientPayloadDialog", () => {
  it("exposes accessible controls and preloads the published payload", () => {
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
    expect(screen.getByText(/Published v4/)).not.toBeNull();
    expect(button("Publish").disabled).toBe(true);
    expect(button("Save draft").disabled).toBe(true);
  });

  it("opens a saved draft instead of the published body", () => {
    renderDialog({
      product: {
        ...EXISTING_PRODUCT,
        expectedDraftRevision: 3,
        draft: {
          format: "json",
          body: '{"maxItems":12}',
          baseVersion: 4,
          updatedAt: 1_720_000_000_100,
        },
      },
    });

    expect(screen.getByLabelText<HTMLSelectElement>("Format").value).toBe(
      "json",
    );
    expect(
      screen.getByLabelText<HTMLTextAreaElement>("Payload body").value,
    ).toBe('{"maxItems":12}');
    expect(screen.getByText(/Draft saved, based on v4/)).not.toBeNull();
    expect(button("Publish").disabled).toBe(false);
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

    await user.click(button("Remove payload"));
    expect(document.activeElement).toBe(button("Keep payload"));

    await user.click(button("Keep payload"));
    expect(document.activeElement).toBe(button("Remove payload"));
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

  it("wraps a maximum-length product ID and keeps aria references valid", () => {
    const productId = "p".repeat(256);
    const { view } = renderDialog({
      product: { ...EXISTING_PRODUCT, productId },
    });
    expect(screen.getByText(productId).classList.contains("break-all")).toBe(
      true,
    );
    view.unmount();

    renderDialog({
      product: { ...EXISTING_PRODUCT, productId: "premium monthly/#1" },
    });
    const describedBy = screen
      .getByLabelText("Payload body")
      .getAttribute("aria-describedby");
    for (const id of describedBy?.split(/\s+/) ?? []) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("saves the draft, then publishes it with both guards and a note", async () => {
    const user = userEvent.setup();
    const { onSaveDraft, onPublish, onClose } = renderDialog();

    await user.selectOptions(screen.getByLabelText("Format"), "json");
    editBody('{"maxItems":12}');
    await user.type(
      screen.getByLabelText("Publish note (optional)"),
      "Raise limit",
    );
    await user.click(button("Publish"));

    await waitFor(() => {
      expect(onPublish).toHaveBeenCalledWith({
        productId: "premium_monthly",
        platform: "IOS",
        expectedVersion: 4,
        expectedDraftRevision: 1,
        note: "Raise limit",
      });
    });
    expect(onSaveDraft).toHaveBeenCalledWith({
      productId: "premium_monthly",
      platform: "IOS",
      format: "json",
      body: '{"maxItems":12}',
      expectedDraftRevision: 0,
      expectedVersion: 4,
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the dialog open after Save draft and publishes that revision", async () => {
    const user = userEvent.setup();
    const { onSaveDraft, onPublish, onClose } = renderDialog({
      onSaveDraft: vi.fn().mockResolvedValue({ revision: 7, baseVersion: 4 }),
    });

    editBody("max_items = 12");
    await user.click(button("Save draft"));
    await waitFor(() => expect(button("Save draft").disabled).toBe(true));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/Draft saved, based on v4/)).not.toBeNull();

    await user.click(button("Publish"));
    await waitFor(() => {
      expect(onPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedVersion: 4,
          expectedDraftRevision: 7,
        }),
      );
    });
    expect(onSaveDraft).toHaveBeenCalledOnce();
  });

  it("creates a first payload guarded by the durable tombstone revision", async () => {
    const user = userEvent.setup();
    const { onSaveDraft, onPublish } = renderDialog({
      product: {
        productId: "coins_100",
        platform: "Android",
        title: "100 Coins",
        expectedVersion: 2,
        expectedDraftRevision: 5,
      },
    });

    await user.selectOptions(screen.getByLabelText("Format"), "text");
    editBody("coins=100");
    await user.click(button("Publish"));

    await waitFor(() => {
      expect(onPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: "coins_100",
          platform: "Android",
          expectedVersion: 2,
        }),
      );
    });
    expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ expectedDraftRevision: 5, expectedVersion: 2 }),
    );
  });

  it("blocks a draft based on an older version until it is rebased", async () => {
    const user = userEvent.setup();
    const staleDraft = (revision: number, body: string, baseVersion = 3) => ({
      ...EXISTING_PRODUCT,
      expectedDraftRevision: revision,
      draft: { format: "toml" as const, body, baseVersion, updatedAt: 1 },
    });
    const props = renderDialog({
      onSaveDraft: vi
        .fn()
        .mockResolvedValueOnce({ revision: 4, baseVersion: 3 })
        .mockResolvedValueOnce({ revision: 5, baseVersion: 4 }),
      product: staleDraft(3, "max_items = 20"),
    });
    // Convex delivers the saved draft back to the dialog.
    const deliver = (product: ClientPayloadProduct) =>
      props.view.rerender(
        <ProductClientPayloadDialog {...props} product={product} />,
      );

    expect(
      screen.getByText(/based on v3, but v4 is the current version/),
    ).not.toBeNull();
    expect(button("Publish").disabled).toBe(true);

    // Saving edits keeps the old base: only a rebase moves it.
    editBody("max_items = 25");
    await user.click(button("Save draft"));
    await waitFor(() => expect(props.onSaveDraft).toHaveBeenCalledOnce());
    expect(props.onSaveDraft).toHaveBeenLastCalledWith({
      productId: "premium_monthly",
      platform: "IOS",
      format: "toml",
      body: "max_items = 25",
      expectedDraftRevision: 3,
    });
    deliver(staleDraft(4, "max_items = 25"));
    expect(button("Publish").disabled).toBe(true);

    await user.click(button("Rebase onto v4"));
    await waitFor(() =>
      expect(props.onSaveDraft).toHaveBeenLastCalledWith(
        expect.objectContaining({
          body: "max_items = 25",
          expectedDraftRevision: 4,
          expectedVersion: 4,
        }),
      ),
    );
    deliver(staleDraft(5, "max_items = 25", 4));
    expect(screen.queryByText(/This draft is based on v3/)).toBeNull();
    expect(button("Publish").disabled).toBe(false);

    await user.click(button("Publish"));
    await waitFor(() => {
      expect(props.onPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedVersion: 4,
          expectedDraftRevision: 5,
        }),
      );
    });
  });

  it("loads a version published elsewhere and keeps unsaved edits", async () => {
    const user = userEvent.setup();
    const props = renderDialog();
    editBody("max_items = 12");

    props.view.rerender(
      <ProductClientPayloadDialog
        {...props}
        product={{
          ...EXISTING_PRODUCT,
          expectedVersion: 5,
          clientPayload: {
            format: "toml",
            body: "max_items = 11",
            version: 5,
            updatedAt: 1_720_000_000_500,
          },
        }}
      />,
    );
    expect(screen.getByText(/changed in another session/)).not.toBeNull();

    await user.click(button("Load latest"));

    expect(screen.queryByText(/changed in another session/)).toBeNull();
    expect(screen.getByText(/Published v5/)).not.toBeNull();
    expect(
      screen.getByLabelText<HTMLTextAreaElement>("Payload body").value,
    ).toBe("max_items = 12");
    await user.click(button("Publish"));
    await waitFor(() => {
      expect(props.onSaveDraft).toHaveBeenCalledWith(
        expect.objectContaining({ expectedVersion: 5 }),
      );
    });
    expect(props.onPublish).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 5 }),
    );
  });

  it("rejects non-object JSON in the editor and the preview", async () => {
    const user = userEvent.setup();
    const { onSaveDraft, onPublish } = renderDialog();

    await user.selectOptions(screen.getByLabelText("Format"), "json");
    editBody("[]");

    expect(
      screen.getAllByText(
        "JSON payload must be an object, not an array or scalar.",
      ),
    ).toHaveLength(2);
    expect(button("Save draft").disabled).toBe(true);
    expect(button("Publish").disabled).toBe(true);
    expect(onSaveDraft).not.toHaveBeenCalled();
    expect(onPublish).not.toHaveBeenCalled();
  });

  it("preserves edits and reports an error when publishing fails", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog({
      onPublish: vi.fn().mockRejectedValue({
        data: { message: "Client payload was changed by another request" },
      }),
    });

    editBody("max_items = 12");
    await user.click(button("Publish"));

    expect(
      await screen.findByText("Client payload was changed by another request"),
    ).not.toBeNull();
    expect(
      screen.getByLabelText<HTMLTextAreaElement>("Payload body").value,
    ).toBe("max_items = 12");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("requires an explicit confirmation before removing the payload", async () => {
    const user = userEvent.setup();
    const { onClose, onRemove } = renderDialog();

    await user.click(button("Remove payload"));
    expect(onRemove).not.toHaveBeenCalled();
    await user.click(button("Confirm remove"));

    await waitFor(() => {
      expect(onRemove).toHaveBeenCalledWith({
        productId: "premium_monthly",
        platform: "IOS",
        expectedVersion: 4,
      });
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the editor open and reports a failed removal", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog({
      onRemove: vi.fn().mockRejectedValue(new Error("Removal failed")),
    });

    await user.click(button("Remove payload"));
    await user.click(button("Confirm remove"));

    expect(await screen.findByText("Removal failed")).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("discards a saved draft with its revision guard", async () => {
    const user = userEvent.setup();
    const { onDiscardDraft, onClose } = renderDialog({
      product: {
        ...EXISTING_PRODUCT,
        expectedDraftRevision: 3,
        draft: {
          format: "toml",
          body: "max_items = 20",
          baseVersion: 4,
          updatedAt: 1,
        },
      },
    });

    await user.click(button("Discard draft"));

    await waitFor(() => {
      expect(onDiscardDraft).toHaveBeenCalledWith({
        productId: "premium_monthly",
        platform: "IOS",
        expectedDraftRevision: 3,
      });
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("previews the diff and the exact app response before and after publish", () => {
    renderDialog({
      sdkPreview: {
        keyPreview: "openiap-kit_...abcd",
        etagScope: "SCOPE",
        productServed: true,
        response: {
          status: 200,
          headers: {
            "Cache-Control": "private, no-cache",
            Vary: "Authorization",
            "Content-Type": "application/json",
            ETag: '"iapkit-client-payload-SCOPE-v4"',
          },
          body: '{"clientPayload":{"format":"toml","body":"max_items = 10","version":4,"updatedAt":1}}',
        },
      },
    });
    editBody("max_items = 12");

    expect(screen.getByText("- max_items = 10")).not.toBeNull();
    expect(screen.getByText("+ max_items = 12")).not.toBeNull();
    expect(screen.getByLabelText("Now response").textContent).toContain(
      'ETag: "iapkit-client-payload-SCOPE-v4"',
    );
    const after = screen.getByLabelText("After publish · v5 response");
    expect(after.textContent).toContain(
      'ETag: "iapkit-client-payload-SCOPE-v5"',
    );
    expect(after.textContent).toContain('"body":"max_items = 12","version":5');
  });

  it("keeps showing a 404 after publish while the product is not served", () => {
    renderDialog({
      product: {
        productId: "coins_100",
        platform: "Android",
        title: "100 Coins",
        expectedVersion: 0,
        expectedDraftRevision: 0,
      },
      sdkPreview: {
        keyPreview: "openiap-kit_...abcd",
        etagScope: "SCOPE",
        productServed: false,
        response: {
          status: 404,
          headers: { "Content-Type": "application/json" },
          body: '{"errors":[]}',
        },
      },
    });
    editBody("coins = 100");

    expect(screen.getByLabelText("Now response").textContent).toContain(
      "HTTP/1.1 404",
    );
    expect(screen.queryByLabelText(/After publish/)).toBeNull();
    expect(screen.getByText(/before and after you publish/)).not.toBeNull();
  });

  it("explains a missing publishable key instead of guessing the ETag", () => {
    renderDialog({ sdkPreview: null });

    expect(
      screen.getByText(/Create a publishable API key to preview/),
    ).not.toBeNull();
  });

  it("lists history and rolls back a selected version after confirmation", async () => {
    const user = userEvent.setup();
    const { onSelectVersion, onRollback, onClose } = renderDialog({
      tab: "history",
      history: [
        {
          version: 4,
          action: "publish",
          format: "toml",
          byteLength: 14,
          author: { type: "user", name: "Hyo" },
          createdAt: 2,
        },
        {
          version: 3,
          action: "publish",
          format: "toml",
          byteLength: 13,
          author: { type: "apiKey", name: "CI" },
          note: "Launch",
          createdAt: 1,
        },
      ],
      selectedVersion: 3,
      selectedVersionDetail: {
        version: 3,
        action: "publish",
        format: "toml",
        body: "max_items = 5",
        createdAt: 1,
      },
    });

    expect(screen.getByText(/Published · live/)).not.toBeNull();
    await user.click(screen.getByRole("button", { name: /^v4/ }));
    expect(onSelectVersion).toHaveBeenCalledWith(4);

    expect(screen.getByText("max_items = 5")).not.toBeNull();
    await user.click(button("Roll back to v3"));
    expect(onRollback).not.toHaveBeenCalled();
    await user.click(button("Confirm rollback"));

    await waitFor(() => {
      expect(onRollback).toHaveBeenCalledWith({
        productId: "premium_monthly",
        platform: "IOS",
        toVersion: 3,
        expectedVersion: 4,
      });
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not offer rollback to the live version", () => {
    const history = [{ version: 4, action: "publish" as const, createdAt: 2 }];
    const detail = {
      version: 4,
      action: "publish" as const,
      body: "max_items = 10",
      createdAt: 2,
    };
    renderDialog({
      tab: "history",
      history,
      selectedVersion: 4,
      selectedVersionDetail: detail,
    });
    expect(screen.queryByRole("button", { name: /Roll back/ })).toBeNull();
  });
});
