/** @vitest-environment jsdom */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type MockPayloadState =
  | {
      expectedVersion: number;
      clientPayload?: {
        format: "toml";
        body: string;
        version: number;
        updatedAt: number;
      };
    }
  | null
  | undefined;

const mocks = vi.hoisted<{
  payload: MockPayloadState;
  mutate: Mock<(...args: unknown[]) => unknown>;
  useQuery: Mock<(...args: unknown[]) => unknown>;
}>(() => {
  return {
    payload: {
      expectedVersion: 4,
      clientPayload: {
        format: "toml",
        body: "max_items = 10",
        version: 4,
        updatedAt: 1_720_000_000_000,
      },
    },
    mutate: vi.fn().mockResolvedValue(undefined),
    useQuery: vi.fn(),
  };
});

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => {
    mocks.useQuery(...args);
    return mocks.payload;
  },
  useMutation: () => mocks.mutate,
}));

vi.mock("@/convex", () => ({
  api: {
    products: {
      query: {
        getProductClientPayloadEditorState:
          "getProductClientPayloadEditorState",
      },
      mutation: {
        upsertProductClientPayload: "upsertProductClientPayload",
        removeProductClientPayload: "removeProductClientPayload",
      },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

import {
  closeProductClientPayloadEditor,
  openProductClientPayloadEditor,
} from "@/lib/signals";
import { ProductClientPayloadDialogRoot } from "./ProductClientPayloadDialog";

const PROJECT_ID = "projects_a" as never;
const OTHER_PROJECT_ID = "projects_b" as never;

describe("ProductClientPayloadDialogRoot", () => {
  beforeEach(() => {
    mocks.payload = {
      expectedVersion: 4,
      clientPayload: {
        format: "toml",
        body: "max_items = 10",
        version: 4,
        updatedAt: 1_720_000_000_000,
      },
    };
    mocks.mutate.mockClear();
    mocks.useQuery.mockClear();
    closeProductClientPayloadEditor();
  });

  afterEach(() => {
    cleanup();
    closeProductClientPayloadEditor();
  });

  it("fetches only the selected authenticated payload and preserves its version guard", async () => {
    const user = userEvent.setup();
    const view = render(<ProductClientPayloadDialogRoot />);

    openProductClientPayloadEditor({
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium_monthly",
      title: "Premium Monthly",
    });

    expect(
      await screen.findByRole("dialog", {
        name: "Edit client payload for premium_monthly on iOS",
      }),
    ).not.toBeNull();
    expect(mocks.useQuery).toHaveBeenLastCalledWith(
      "getProductClientPayloadEditorState",
      {
        projectId: PROJECT_ID,
        platform: "IOS",
        productId: "premium_monthly",
      },
    );
    await waitFor(() => {
      expect(
        screen.getByLabelText<HTMLTextAreaElement>("Payload body").value,
      ).toBe("max_items = 10");
    });

    fireEvent.change(screen.getByLabelText("Payload body"), {
      target: { value: "max_items = 12" },
    });

    // Simulate another tab updating the reactive exact query while this draft
    // is open. The editor must retain both the draft and original version 4.
    mocks.payload = {
      expectedVersion: 5,
      clientPayload: {
        format: "toml",
        body: "max_items = 99",
        version: 5,
        updatedAt: 1_720_000_000_100,
      },
    };
    view.rerender(<ProductClientPayloadDialogRoot />);
    expect(
      screen.getByLabelText<HTMLTextAreaElement>("Payload body").value,
    ).toBe("max_items = 12");
    expect(screen.getByText(/Version 4/)).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Save payload" }));

    await waitFor(() => {
      expect(mocks.mutate).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        platform: "IOS",
        productId: "premium_monthly",
        format: "toml",
        body: "max_items = 12",
        expectedVersion: 4,
      });
    });
  });

  it("resets the snapshot when switching targets or reopening", async () => {
    const view = render(<ProductClientPayloadDialogRoot />);
    openProductClientPayloadEditor({
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium_monthly",
      title: "Premium Monthly",
    });
    await screen.findByLabelText<HTMLTextAreaElement>("Payload body");
    await waitFor(() => {
      expect(
        screen.getByLabelText<HTMLTextAreaElement>("Payload body").value,
      ).toBe("max_items = 10");
    });

    mocks.payload = {
      expectedVersion: 2,
      clientPayload: {
        format: "toml",
        body: "coins = 100",
        version: 2,
        updatedAt: 1_720_000_000_200,
      },
    };
    openProductClientPayloadEditor({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "coins_100",
      title: "100 Coins",
    });
    view.rerender(<ProductClientPayloadDialogRoot />);
    expect(
      await screen.findByRole("dialog", {
        name: "Edit client payload for coins_100 on Android",
      }),
    ).not.toBeNull();
    expect(
      screen.getByLabelText<HTMLTextAreaElement>("Payload body").value,
    ).toBe("coins = 100");

    closeProductClientPayloadEditor();
    mocks.payload = {
      expectedVersion: 3,
      clientPayload: {
        format: "toml",
        body: "coins = 200",
        version: 3,
        updatedAt: 1_720_000_000_300,
      },
    };
    openProductClientPayloadEditor({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "coins_100",
      title: "100 Coins",
    });
    view.rerender(<ProductClientPayloadDialogRoot />);
    await waitFor(() => {
      expect(
        screen.getByLabelText<HTMLTextAreaElement>("Payload body").value,
      ).toBe("coins = 200");
    });
    expect(screen.getByText(/Version 3/)).not.toBeNull();

    mocks.payload = {
      expectedVersion: 1,
      clientPayload: {
        format: "toml",
        body: "coins = 300",
        version: 1,
        updatedAt: 1_720_000_000_400,
      },
    };
    openProductClientPayloadEditor({
      projectId: OTHER_PROJECT_ID,
      platform: "Android",
      productId: "coins_100",
      title: "100 Coins (Other Project)",
    });
    view.rerender(<ProductClientPayloadDialogRoot />);
    await waitFor(() => {
      expect(
        screen.getByLabelText<HTMLTextAreaElement>("Payload body").value,
      ).toBe("coins = 300");
    });
    expect(mocks.useQuery).toHaveBeenLastCalledWith(
      "getProductClientPayloadEditorState",
      expect.objectContaining({ projectId: OTHER_PROJECT_ID }),
    );
    expect(screen.getByText(/Version 1/)).not.toBeNull();
  });

  it("disables editing until the exact payload query resolves", async () => {
    mocks.payload = undefined;
    render(<ProductClientPayloadDialogRoot />);

    openProductClientPayloadEditor({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "coins_100",
      title: "100 Coins",
    });

    expect((await screen.findByRole("status")).textContent).toContain(
      "Loading the current payload",
    );
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Save payload" })
        .disabled,
    ).toBe(true);
    expect(
      screen.getByLabelText<HTMLTextAreaElement>("Payload body").disabled,
    ).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Cancel" })
        .disabled,
    ).toBe(false);
  });

  it("uses the durable tombstone revision when recreating a removed payload", async () => {
    const user = userEvent.setup();
    mocks.payload = { expectedVersion: 2 };
    render(<ProductClientPayloadDialogRoot />);

    openProductClientPayloadEditor({
      projectId: PROJECT_ID,
      platform: "Android",
      productId: "coins_100",
      title: "100 Coins",
    });

    await user.selectOptions(await screen.findByLabelText("Format"), "text");
    fireEvent.change(screen.getByLabelText("Payload body"), {
      target: { value: "coins=100" },
    });
    await user.click(screen.getByRole("button", { name: "Save payload" }));

    await waitFor(() => {
      expect(mocks.mutate).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        platform: "Android",
        productId: "coins_100",
        format: "text",
        body: "coins=100",
        expectedVersion: 2,
      });
    });
  });
});
