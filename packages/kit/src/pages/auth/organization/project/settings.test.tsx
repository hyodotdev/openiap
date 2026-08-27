/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  downloadFile: vi.fn(),
  fetch: vi.fn(),
  generateUploadUrl: vi.fn(),
  otherMutation: vi.fn(),
  project: {
    _id: "projects_test",
    organizationId: "organizations_test",
    name: "Test Project",
    slug: "test-project",
    iosBundleId: "com.example.test",
    iosAppStoreIssuerId: "12345678-ABCD-1234-ABCD-1234567890AB",
    iosAppStoreKeyId: "ABCDE12345",
    androidPackageName: "com.markhub.markly",
    amazonSandboxEnabled: false,
  },
  saveFile: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  validateGoogleServiceAccount: vi.fn(),
  validateScreenshot: vi.fn(),
  files: [] as Array<Record<string, unknown>>,
}));

const FLAT_PNG_BYTES = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAEElEQVR4nGP8wwACLGCSAQANBAECv1AVswAAAABJRU5ErkJggg==",
  ),
  (character) => character.charCodeAt(0),
);

function testFile(bytes: Uint8Array, name: string, type: string): File {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const file = new File([buffer], name, { type });
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: async () => buffer,
  });
  return file;
}

function pngBytesWithTransparencyChunk(): Uint8Array {
  const bytes = new Uint8Array(46);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(bytes.buffer).setUint32(8, 13, false);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  bytes[25] = 3;
  new DataView(bytes.buffer).setUint32(33, 1, false);
  bytes.set([0x74, 0x52, 0x4e, 0x53], 37);
  return bytes;
}

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({
    project: mocks.project,
  }),
}));

vi.mock("convex/react", () => ({
  useAction: (reference: string) => {
    if (reference === "files.validateAppleReviewScreenshotUpload") {
      return mocks.validateScreenshot;
    }
    if (reference === "files.validateGoogleServiceAccountUpload") {
      return mocks.validateGoogleServiceAccount;
    }
    return mocks.downloadFile;
  },
  useMutation: (reference: string) => {
    if (reference === "files.generateUploadUrl") {
      return mocks.generateUploadUrl;
    }
    if (reference === "files.saveFile") return mocks.saveFile;
    return mocks.otherMutation;
  },
  useQuery: () => mocks.files,
}));

vi.mock("@/convex", () => ({
  api: {
    files: {
      action: {
        downloadFile: "files.downloadFile",
        validateAppleReviewScreenshotUpload:
          "files.validateAppleReviewScreenshotUpload",
        validateGoogleServiceAccountUpload:
          "files.validateGoogleServiceAccountUpload",
      },
      mutation: {
        generateUploadUrl: "files.generateUploadUrl",
        remove: "files.remove",
        saveFile: "files.saveFile",
      },
      query: { list: "files.list" },
    },
    projects: { mutation: { updateProject: "projects.updateProject" } },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
  },
}));

import ProjectSettings from "./settings";

const TARGET_PENDING_MESSAGE =
  "The file was not saved because this project or organization is pending deletion.";
const AUTHORIZATION_LOST_MESSAGE =
  "The file was not saved because your access changed during the upload. Please sign in and try again.";

describe("ProjectSettings", () => {
  beforeEach(() => {
    mocks.project.amazonSandboxEnabled = false;
    mocks.downloadFile.mockReset();
    mocks.fetch.mockReset();
    mocks.generateUploadUrl.mockReset();
    mocks.otherMutation.mockReset();
    mocks.saveFile.mockReset();
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.validateGoogleServiceAccount.mockReset();
    mocks.validateScreenshot.mockReset();
    mocks.files = [];
    mocks.generateUploadUrl.mockResolvedValue({
      uploadUrl: "https://upload.example.test",
      uploadReservationId: "fileUploadReservations_test",
      expiresAt: Date.now() + 60_000,
    });
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ storageId: "storage_test" }),
    });
    mocks.saveFile.mockResolvedValue({
      success: false,
      code: "TARGET_PENDING_DELETION",
    });
    mocks.validateScreenshot.mockResolvedValue({ valid: true });
    mocks.validateGoogleServiceAccount.mockResolvedValue({ valid: true });
    vi.stubGlobal("fetch", mocks.fetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("allows correcting a stored Android package name with exact capitalization", async () => {
    mocks.otherMutation.mockResolvedValueOnce(undefined);
    render(<ProjectSettings />);

    const input =
      screen.getByLabelText<HTMLInputElement>(/Android package name/);
    expect(input.disabled).toBe(false);

    fireEvent.change(input, { target: { value: "com.markhub.Markly" } });
    fireEvent.click(screen.getByRole("button", { name: "Save identifiers" }));

    await waitFor(() => {
      expect(mocks.otherMutation).toHaveBeenCalledWith({
        projectId: "projects_test",
        androidPackageName: "com.markhub.Markly",
        iosBundleId: "com.example.test",
        iosAppStoreIssuerId: "12345678-ABCD-1234-ABCD-1234567890AB",
        iosAppStoreKeyId: "ABCDE12345",
      });
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Identifiers updated successfully",
    );
  });

  it("prevents replacing a stored Android package name", () => {
    render(<ProjectSettings />);

    fireEvent.change(
      screen.getByLabelText<HTMLInputElement>(/Android package name/),
      { target: { value: "com.example.Other" } },
    );

    expect(
      screen.getByRole<HTMLButtonElement>("button", {
        name: "Save identifiers",
      }).disabled,
    ).toBe(true);
    expect(
      screen.getByText(
        "A saved Android package name can only be updated to correct capitalization.",
      ),
    ).toBeTruthy();
  });

  it("saves an Amazon sandbox opt-in without requiring a production secret", async () => {
    mocks.otherMutation.mockResolvedValueOnce(undefined);
    render(<ProjectSettings />);

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Allow Amazon App Tester \/ RVS Cloud Sandbox/,
      }),
    );
    const save = screen.getByRole<HTMLButtonElement>("button", {
      name: "Save Amazon config",
    });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => {
      expect(mocks.otherMutation).toHaveBeenCalledWith({
        projectId: "projects_test",
        amazonSandboxEnabled: true,
      });
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Amazon RVS configuration saved.",
    );
  });

  it("keeps uploaded-file actions in wrapping cards", () => {
    mocks.files = [
      {
        _id: "files_apple_server",
        projectId: "projects_test",
        purpose: "apple_p8_key",
        fileName: "SubscriptionKey_WithAnIntentionallyLongName.p8",
        fileSize: 256,
      },
      {
        _id: "files_apple_connect",
        projectId: "projects_test",
        purpose: "apple_p8_asc_api_key",
        fileName: "ConnectKey_WithAnIntentionallyLongName.p8",
        fileSize: 256,
      },
      {
        _id: "files_apple_review",
        projectId: "projects_test",
        purpose: "apple_iap_review_screenshot",
        fileName: "ReviewScreenshot_WithAnIntentionallyLongName.png",
        fileSize: 1024,
      },
      {
        _id: "files_android",
        projectId: "projects_test",
        purpose: "android_service_account",
        fileName: "ServiceAccount_WithAnIntentionallyLongName.json",
        fileSize: 256,
      },
    ];

    render(<ProjectSettings />);

    for (const status of [
      "Authentication file uploaded successfully",
      "Connect API key uploaded successfully",
      "App Review screenshot configured",
      "Service account file uploaded successfully",
    ]) {
      const card = screen.getByText(status).closest(".contained-action-card");
      expect(card).not.toBeNull();
      expect(
        card?.querySelector(".contained-action-card__content"),
      ).toBeTruthy();
      expect(card?.querySelector(".contained-action-card__text")).toBeTruthy();
      expect(
        card?.querySelector(".contained-action-card__actions"),
      ).toBeTruthy();
    }
  });

  it("replaces an existing Google service-account file without deleting first", async () => {
    mocks.files = [
      {
        _id: "files_android",
        projectId: "projects_test",
        purpose: "android_service_account",
        fileName: "old-service-account.json",
        fileSize: 256,
        createdAt: 1,
      },
    ];
    mocks.saveFile.mockResolvedValueOnce({
      success: true,
      _id: "files_android_replacement",
    });
    render(<ProjectSettings />);

    const replaceControl = screen.getByLabelText(
      "Replace service account JSON",
    );
    expect(replaceControl.id).toBe("android-file-upload");
    expect(replaceControl.className).toContain("sr-only");
    expect(replaceControl.className).not.toContain("hidden");
    expect(replaceControl.nextElementSibling?.className).toContain(
      "peer-focus-visible:ring-2",
    );
    expect(screen.getByTitle("Replace JSON file").getAttribute("for")).toBe(
      "android-file-upload",
    );
    Object.defineProperty(replaceControl, "value", {
      configurable: true,
      value: "C:\\fakepath\\replacement.json",
      writable: true,
    });
    fireEvent.change(replaceControl, {
      target: {
        files: [
          new File(["new private credential"], "replacement.json", {
            type: "application/json",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(mocks.saveFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: "replacement.json",
          purpose: "android_service_account",
        }),
      );
    });
    expect(mocks.otherMutation).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Android service account uploaded successfully",
    );
    expect((replaceControl as HTMLInputElement).value).toBe("");
  });

  it("reports the private-file permission when a member cannot replace Android credentials", async () => {
    mocks.files = [
      {
        _id: "files_android",
        projectId: "projects_test",
        purpose: "android_service_account",
        fileName: "old-service-account.json",
        fileSize: 256,
        createdAt: 1,
      },
    ];
    mocks.saveFile.mockResolvedValueOnce({
      success: false,
      code: "INSUFFICIENT_PERMISSIONS",
    });
    render(<ProjectSettings />);

    fireEvent.change(screen.getByLabelText("Replace service account JSON"), {
      target: {
        files: [
          new File(["private credential"], "replacement.json", {
            type: "application/json",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Only an organization admin or owner can configure private project files.",
      );
    });
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("keeps the current Android credential when server validation rejects a replacement", async () => {
    mocks.files = [
      {
        _id: "files_android",
        projectId: "projects_test",
        purpose: "android_service_account",
        fileName: "current.json",
        fileSize: 256,
        createdAt: 1,
      },
    ];
    mocks.validateGoogleServiceAccount.mockRejectedValueOnce(
      new Error("Google service-account JSON contains an invalid private key"),
    );
    render(<ProjectSettings />);

    fireEvent.change(screen.getByLabelText("Replace service account JSON"), {
      target: {
        files: [
          new File(["invalid"], "replacement.json", {
            type: "application/json",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Google service-account JSON contains an invalid private key",
      );
    });
    expect(mocks.saveFile).not.toHaveBeenCalled();
    expect(screen.getByText("current.json", { exact: false })).toBeTruthy();
  });

  it.each([
    {
      inputId: "ios-file-upload",
      fileName: "AuthKey.p8",
      mimeType: "application/octet-stream",
      successText: "Authentication file uploaded successfully",
      purpose: "apple_p8_key",
    },
    {
      inputId: "ios-asc-file-upload",
      fileName: "ConnectKey.p8",
      mimeType: "application/octet-stream",
      successText: "Connect API key uploaded successfully",
      purpose: "apple_p8_asc_api_key",
    },
    {
      inputId: "ios-review-screenshot-upload",
      fileName: "review.png",
      mimeType: "image/png",
      successText: "App Review screenshot uploaded successfully",
      purpose: "apple_iap_review_screenshot",
    },
    {
      inputId: "android-file-upload",
      fileName: "service-account.json",
      mimeType: "application/json",
      successText: "Service account file uploaded successfully",
      purpose: "android_service_account",
    },
  ])(
    "does not mark $inputId successful when its target is pending deletion",
    async ({ inputId, fileName, mimeType, successText, purpose }) => {
      render(<ProjectSettings />);
      const input = document.getElementById(inputId) as HTMLInputElement;
      expect(input).not.toBeNull();

      fireEvent.change(input, {
        target: {
          files: [
            purpose === "apple_iap_review_screenshot"
              ? testFile(FLAT_PNG_BYTES, fileName, mimeType)
              : new File(["private credential"], fileName, { type: mimeType }),
          ],
        },
      });

      await waitFor(() => {
        expect(mocks.saveFile).toHaveBeenCalledOnce();
        expect(mocks.toastError).toHaveBeenCalledWith(TARGET_PENDING_MESSAGE);
      });
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
      expect(screen.queryByText(successText)).toBeNull();
      expect(document.getElementById(inputId)).not.toBeNull();
      expect(mocks.generateUploadUrl).toHaveBeenCalledWith({
        organizationId: "organizations_test",
        projectId: "projects_test",
      });
      expect(mocks.fetch).toHaveBeenCalledWith(
        "https://upload.example.test",
        expect.any(Object),
      );
      expect(mocks.saveFile).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "organizations_test",
          projectId: "projects_test",
          uploadReservationId: "fileUploadReservations_test",
          storageId: "storage_test",
          purpose,
        }),
      );
      if (purpose === "apple_iap_review_screenshot") {
        expect(mocks.validateScreenshot).toHaveBeenCalledWith({
          organizationId: "organizations_test",
          projectId: "projects_test",
          uploadReservationId: "fileUploadReservations_test",
          storageId: "storage_test",
          fileName,
          fileType: mimeType,
          fileSize: FLAT_PNG_BYTES.byteLength,
        });
        expect(
          mocks.validateScreenshot.mock.invocationCallOrder[0],
        ).toBeLessThan(mocks.saveFile.mock.invocationCallOrder[0]);
        expect(mocks.validateGoogleServiceAccount).not.toHaveBeenCalled();
      } else if (purpose === "android_service_account") {
        expect(mocks.validateGoogleServiceAccount).toHaveBeenCalledWith({
          organizationId: "organizations_test",
          projectId: "projects_test",
          uploadReservationId: "fileUploadReservations_test",
          storageId: "storage_test",
          fileName,
          fileType: mimeType,
          fileSize: expect.any(Number),
        });
        expect(
          mocks.validateGoogleServiceAccount.mock.invocationCallOrder[0],
        ).toBeLessThan(mocks.saveFile.mock.invocationCallOrder[0]);
        expect(mocks.validateScreenshot).not.toHaveBeenCalled();
      } else {
        expect(mocks.validateScreenshot).not.toHaveBeenCalled();
        expect(mocks.validateGoogleServiceAccount).not.toHaveBeenCalled();
      }
      expect(JSON.stringify(mocks.toastError.mock.calls)).not.toContain(
        "private credential",
      );
    },
  );

  it("surfaces a changed-access message when authorization disappears after upload", async () => {
    mocks.saveFile.mockResolvedValueOnce({
      success: false,
      code: "AUTHORIZATION_LOST",
    });
    render(<ProjectSettings />);

    fireEvent.change(document.getElementById("android-file-upload")!, {
      target: {
        files: [
          new File(["private credential"], "service-account.json", {
            type: "application/json",
          }),
        ],
      },
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(AUTHORIZATION_LOST_MESSAGE);
    });
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it.each([
    [
      "review.gif",
      "image/gif",
      "Upload a PNG or JPEG whose extension matches its format.",
    ],
    [
      "review.png",
      "application/octet-stream",
      "Upload a PNG or JPEG whose extension matches its format.",
    ],
  ])(
    "rejects unsupported App Review screenshot %s before reserving storage",
    async (fileName, mimeType, message) => {
      render(<ProjectSettings />);

      fireEvent.change(
        document.getElementById("ios-review-screenshot-upload")!,
        {
          target: {
            files: [testFile(FLAT_PNG_BYTES, fileName, mimeType)],
          },
        },
      );

      await waitFor(() => {
        expect(mocks.toastError).toHaveBeenCalledWith(message);
      });
      expect(mocks.generateUploadUrl).not.toHaveBeenCalled();
      expect(mocks.fetch).not.toHaveBeenCalled();
      expect(mocks.saveFile).not.toHaveBeenCalled();
    },
  );

  it("stores a valid flattened PNG and waits for the reactive row before showing actions", async () => {
    mocks.saveFile.mockResolvedValueOnce({
      success: true,
      _id: "files_screenshot",
    });
    const view = render(<ProjectSettings />);

    fireEvent.change(document.getElementById("ios-review-screenshot-upload")!, {
      target: {
        files: [testFile(FLAT_PNG_BYTES, "review.png", "image/png")],
      },
    });

    await waitFor(() => {
      expect(mocks.saveFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: "review.png",
          fileType: "image/png",
          purpose: "apple_iap_review_screenshot",
        }),
      );
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "App Review screenshot uploaded successfully",
      );
    });
    expect(screen.queryByText("App Review screenshot configured")).toBeNull();

    mocks.files = [
      {
        _id: "files_screenshot",
        projectId: "projects_test",
        purpose: "apple_iap_review_screenshot",
        fileName: "review.png",
        fileType: "image/png",
        fileSize: FLAT_PNG_BYTES.byteLength,
      },
    ];
    view.rerender(<ProjectSettings />);
    expect(screen.getByText("App Review screenshot configured")).toBeTruthy();

    fireEvent.click(screen.getByTitle("Remove stored screenshot from IAPKit"));
    await waitFor(() => {
      expect(mocks.otherMutation).toHaveBeenCalledWith({
        fileId: "files_screenshot",
      });
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Stored App Review screenshot removed from IAPKit",
      );
    });
  });

  it("rejects a spoofed image signature and PNG alpha before reserving storage", async () => {
    const alphaPng = new Uint8Array(FLAT_PNG_BYTES);
    alphaPng[25] = 6;
    render(<ProjectSettings />);
    const input = document.getElementById(
      "ios-review-screenshot-upload",
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: {
        files: [
          testFile(
            new TextEncoder().encode("not really png"),
            "spoofed.png",
            "image/png",
          ),
        ],
      },
    });
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "The selected file is not a valid PNG or JPEG image.",
      );
    });

    fireEvent.change(input, {
      target: {
        files: [testFile(alphaPng, "alpha.png", "image/png")],
      },
    });
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "App Review PNG screenshots must be flattened (no alpha channel).",
      );
    });

    fireEvent.change(input, {
      target: {
        files: [
          testFile(
            pngBytesWithTransparencyChunk(),
            "transparent.png",
            "image/png",
          ),
        ],
      },
    });
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "App Review PNG screenshots must be flattened (no transparency metadata).",
      );
    });
    expect(mocks.generateUploadUrl).not.toHaveBeenCalled();
  });

  it("rejects an oversized screenshot and exposes a keyboard-focusable file input", async () => {
    render(<ProjectSettings />);
    const input = screen.getByLabelText<HTMLInputElement>(
      "Click to upload PNG or JPEG",
    );
    expect(input.className).toContain("sr-only");
    expect(input.tabIndex).toBe(0);

    const oversized = testFile(FLAT_PNG_BYTES, "large.png", "image/png");
    Object.defineProperty(oversized, "size", {
      configurable: true,
      value: 10 * 1024 * 1024 + 1,
    });
    fireEvent.change(input, { target: { files: [oversized] } });
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "App Review screenshots must be 10 MB or smaller.",
      );
    });
    expect(mocks.generateUploadUrl).not.toHaveBeenCalled();
  });

  it("surfaces server-side screenshot validation errors", async () => {
    mocks.validateScreenshot.mockRejectedValueOnce(
      new Error("App Review screenshot size does not match the uploaded blob"),
    );
    render(<ProjectSettings />);

    fireEvent.change(document.getElementById("ios-review-screenshot-upload")!, {
      target: {
        files: [testFile(FLAT_PNG_BYTES, "review.png", "image/png")],
      },
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "App Review screenshot size does not match the uploaded blob",
      );
    });
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.saveFile).not.toHaveBeenCalled();
  });
});
