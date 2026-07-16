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
  saveFile: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({
    project: {
      _id: "projects_test",
      organizationId: "organizations_test",
      name: "Test Project",
      slug: "test-project",
      iosBundleId: "com.example.test",
      androidPackageName: "com.example.test",
    },
  }),
}));

vi.mock("convex/react", () => ({
  useAction: () => mocks.downloadFile,
  useMutation: (reference: string) => {
    if (reference === "files.generateUploadUrl") {
      return mocks.generateUploadUrl;
    }
    if (reference === "files.saveFile") return mocks.saveFile;
    return mocks.otherMutation;
  },
  useQuery: () => [],
}));

vi.mock("@/convex", () => ({
  api: {
    files: {
      action: { downloadFile: "files.downloadFile" },
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

describe("ProjectSettings credential uploads", () => {
  beforeEach(() => {
    mocks.downloadFile.mockReset();
    mocks.fetch.mockReset();
    mocks.generateUploadUrl.mockReset();
    mocks.otherMutation.mockReset();
    mocks.saveFile.mockReset();
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
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
    vi.stubGlobal("fetch", mocks.fetch);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    {
      inputId: "ios-file-upload",
      fileName: "AuthKey.p8",
      mimeType: "application/octet-stream",
      successText: "Authentication file uploaded successfully",
    },
    {
      inputId: "ios-asc-file-upload",
      fileName: "ConnectKey.p8",
      mimeType: "application/octet-stream",
      successText: "Connect API key uploaded successfully",
    },
    {
      inputId: "android-file-upload",
      fileName: "service-account.json",
      mimeType: "application/json",
      successText: "Service account file uploaded successfully",
    },
  ])(
    "does not mark $inputId successful when its target is pending deletion",
    async ({ inputId, fileName, mimeType, successText }) => {
      render(<ProjectSettings />);
      const input = document.getElementById(inputId) as HTMLInputElement;
      expect(input).not.toBeNull();

      fireEvent.change(input, {
        target: {
          files: [
            new File(["private credential"], fileName, { type: mimeType }),
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
        }),
      );
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
});
