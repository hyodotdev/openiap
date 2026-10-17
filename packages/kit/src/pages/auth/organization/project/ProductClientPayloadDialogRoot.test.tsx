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

type MockWorkspace =
  | {
      expectedVersion: number;
      expectedDraftRevision: number;
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
  workspace: MockWorkspace;
  mutations: Map<string, Mock<(...args: unknown[]) => unknown>>;
  useQuery: Mock<(...args: unknown[]) => unknown>;
}>(() => ({
  workspace: undefined,
  mutations: new Map(),
  useQuery: vi.fn(),
}));

function mutation(name: string): Mock<(...args: unknown[]) => unknown> {
  let mock = mocks.mutations.get(name);
  if (!mock) {
    mock = vi.fn().mockResolvedValue({ version: 5, revision: 1 });
    mocks.mutations.set(name, mock);
  }
  return mock;
}

vi.mock("convex/react", () => ({
  useQuery: (name: unknown, args: unknown) => {
    mocks.useQuery(name, args);
    if (args === "skip") return undefined;
    if (name === "getProductClientPayloadWorkspace") return mocks.workspace;
    if (name === "listProductClientPayloadHistory") return [];
    return null;
  },
  useMutation: (name: string) => mutation(name),
}));

vi.mock("@/convex", () => ({
  api: {
    products: {
      query: {
        getProductClientPayloadWorkspace: "getProductClientPayloadWorkspace",
        getProductClientPayloadSdkPreview: "getProductClientPayloadSdkPreview",
        listProductClientPayloadHistory: "listProductClientPayloadHistory",
        getProductClientPayloadHistoryVersion:
          "getProductClientPayloadHistoryVersion",
      },
      mutation: {
        saveProductClientPayloadDraft: "saveProductClientPayloadDraft",
        publishProductClientPayloadDraft: "publishProductClientPayloadDraft",
        discardProductClientPayloadDraft: "discardProductClientPayloadDraft",
        removeProductClientPayload: "removeProductClientPayload",
        rollbackProductClientPayload: "rollbackProductClientPayload",
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

function workspace(version: number, body: string): MockWorkspace {
  return {
    expectedVersion: version,
    expectedDraftRevision: 0,
    clientPayload: {
      format: "toml",
      body,
      version,
      updatedAt: 1_720_000_000_000 + version,
    },
  };
}

function bodyValue(): string {
  return screen.getByLabelText<HTMLTextAreaElement>("Payload body").value;
}

describe("ProductClientPayloadDialogRoot", () => {
  beforeEach(() => {
    mocks.workspace = workspace(4, "max_items = 10");
    mocks.mutations.clear();
    mocks.useQuery.mockClear();
    closeProductClientPayloadEditor();
  });

  afterEach(() => {
    cleanup();
    closeProductClientPayloadEditor();
  });

  it("queries only the selected product and keeps its version guard across reactive updates", async () => {
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
    const args = {
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium_monthly",
    };
    expect(mocks.useQuery).toHaveBeenCalledWith(
      "getProductClientPayloadWorkspace",
      args,
    );
    expect(mocks.useQuery).toHaveBeenCalledWith(
      "getProductClientPayloadSdkPreview",
      args,
    );
    expect(mocks.useQuery).toHaveBeenCalledWith(
      "listProductClientPayloadHistory",
      "skip",
    );
    await waitFor(() => expect(bodyValue()).toBe("max_items = 10"));

    fireEvent.change(screen.getByLabelText("Payload body"), {
      target: { value: "max_items = 12" },
    });
    // Another tab publishes v5 while this one is open.
    mocks.workspace = workspace(5, "max_items = 99");
    view.rerender(<ProductClientPayloadDialogRoot />);
    expect(bodyValue()).toBe("max_items = 12");
    expect(screen.getByText(/changed in another session/)).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      expect(mutation("publishProductClientPayloadDraft")).toHaveBeenCalledWith(
        {
          projectId: PROJECT_ID,
          platform: "IOS",
          productId: "premium_monthly",
          expectedVersion: 4,
          expectedDraftRevision: 1,
        },
      );
    });
    expect(mutation("saveProductClientPayloadDraft")).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium_monthly",
      format: "toml",
      body: "max_items = 12",
      expectedDraftRevision: 0,
      expectedVersion: 4,
    });
  });

  it("loads history only on its tab and resets the view for another product", async () => {
    const user = userEvent.setup();
    const view = render(<ProductClientPayloadDialogRoot />);
    openProductClientPayloadEditor({
      projectId: PROJECT_ID,
      platform: "IOS",
      productId: "premium_monthly",
      title: "Premium Monthly",
    });
    await user.click(await screen.findByRole("tab", { name: "History" }));
    expect(mocks.useQuery).toHaveBeenLastCalledWith(
      "getProductClientPayloadHistoryVersion",
      "skip",
    );
    expect(mocks.useQuery).toHaveBeenCalledWith(
      "listProductClientPayloadHistory",
      expect.objectContaining({ productId: "premium_monthly" }),
    );
    expect(screen.getByText(/No published versions yet/)).not.toBeNull();

    mocks.workspace = workspace(1, "coins = 300");
    openProductClientPayloadEditor({
      projectId: OTHER_PROJECT_ID,
      platform: "Android",
      productId: "coins_100",
      title: "100 Coins",
    });
    view.rerender(<ProductClientPayloadDialogRoot />);
    await waitFor(() => expect(bodyValue()).toBe("coins = 300"));
    expect(
      screen
        .getByRole("tab", { name: "Preview" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(mocks.useQuery).toHaveBeenCalledWith(
      "getProductClientPayloadWorkspace",
      expect.objectContaining({ projectId: OTHER_PROJECT_ID }),
    );
  });

  it("disables editing until the workspace query resolves", async () => {
    mocks.workspace = undefined;
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
      screen.getByRole<HTMLButtonElement>("button", { name: "Publish" })
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
});
