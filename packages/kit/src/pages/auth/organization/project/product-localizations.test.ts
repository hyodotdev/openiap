import { describe, expect, it } from "vitest";

import { resolveProductListingDraft } from "./product-localizations";

const row = (
  locale: string,
  title: string,
  description = "",
): { locale: string; title: string; description: string } => ({
  locale,
  title,
  description,
});

const resolve = (
  rows: Array<{ locale: string; title: string; description: string }>,
  state: {
    editingExisting?: boolean;
    isLoadedRow?: boolean;
    regionsInput?: string;
    supportsSalesRegions?: boolean;
  } = {},
) =>
  resolveProductListingDraft({
    rows,
    editingExisting: state.editingExisting ?? false,
    isLoadedRow: state.isLoadedRow ?? false,
    regionsInput: state.regionsInput,
    supportsSalesRegions: state.supportsSalesRegions ?? false,
  });

describe("resolveProductListingDraft", () => {
  it("trims and keeps a blank description off the payload", () => {
    expect(resolve([row(" ko-KR ", " 코인 ", "   ")])).toEqual({
      ok: true,
      localizations: [
        { locale: "ko-KR", title: "코인", description: undefined },
      ],
    });
  });

  it("ignores an entirely blank row instead of rejecting it", () => {
    // The form always renders one empty row to type into. Treating that
    // as an error would make a product with no translations unsavable.
    expect(resolve([row("", "")])).toEqual({
      ok: true,
      localizations: undefined,
      regions: undefined,
    });
  });

  it("refuses a half-typed row rather than dropping it", () => {
    // Silently filtering it out would clear the form and lose the text
    // the operator typed, with nothing shown to explain why.
    expect(resolve([row("ko-KR", "")])).toEqual({
      ok: false,
      error: "Every language needs both a locale and a title",
    });
    expect(resolve([row("", "코인")])).toEqual({
      ok: false,
      error: "Every language needs both a locale and a title",
    });
  });

  it("blocks a replace-by-accident on an existing product", () => {
    // The push REPLACES the stored list, so typing one language into a
    // product that already has five would delete the other four.
    expect(
      resolve([row("ja-JP", "コイン")], {
        editingExisting: true,
        isLoadedRow: false,
      }),
    ).toEqual({
      ok: false,
      error:
        "Load this product's stored languages first — saving now would replace them",
    });
  });

  it("leaves stored languages alone when the operator never opened them", () => {
    // Editing only the price of an existing product must not touch its
    // translations: `undefined` is the mutation's "leave unchanged".
    expect(
      resolve([row("", "")], { editingExisting: true, isLoadedRow: false }),
    ).toEqual({ ok: true, localizations: undefined });
  });

  it("sends an empty list once loaded, so a delete-all actually clears", () => {
    // A loaded row shows every stored locale. Emptying it is deliberate,
    // and `undefined` there would be read as "leave unchanged" — the
    // operator would delete the rows, save, and see them come back.
    expect(
      resolve([row("", "")], { editingExisting: true, isLoadedRow: true }),
    ).toEqual({ ok: true, localizations: [] });
  });

  it("saves the edited set of a loaded row", () => {
    expect(
      resolve([row("ko-KR", "코인", "100개"), row("ja-JP", "コイン")], {
        editingExisting: true,
        isLoadedRow: true,
      }),
    ).toEqual({
      ok: true,
      localizations: [
        { locale: "ko-KR", title: "코인", description: "100개" },
        { locale: "ja-JP", title: "コイン", description: undefined },
      ],
    });
  });

  it("accepts languages typed on a brand-new product", () => {
    expect(resolve([row("ko-KR", "코인")])).toEqual({
      ok: true,
      localizations: [
        { locale: "ko-KR", title: "코인", description: undefined },
      ],
    });
  });
});
