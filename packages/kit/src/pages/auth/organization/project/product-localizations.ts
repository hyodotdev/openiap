/**
 * Turns the product form's language rows and sales-region input into the
 * `localizations` / `regions` arguments `upsertProduct` expects.
 *
 * Extracted from the form because the three-way distinction below is the
 * part that has been wrong before — sending `[]` where `undefined` was
 * meant deletes an operator's stored translations, and sending a
 * partially-typed list replaces the rest of them. Both fields REPLACE on
 * write, so they share one load-before-edit guard.
 */

export interface ProductLocalizationRow {
  locale: string;
  title: string;
  description: string;
}

export interface ResolvedProductListingDraft {
  /** Ready to send: a list, or `undefined` to leave the stored value alone. */
  localizations?: Array<{
    locale: string;
    title: string;
    description?: string;
  }>;
  /**
   * `"all"` to sell everywhere, a list to restrict, `undefined` to leave
   * the stored footprint alone (and, on a new product, to let the store
   * default apply).
   */
  regions?: "all" | string[];
}

export type ProductListingDraftResolution =
  | ({ ok: true } & ResolvedProductListingDraft)
  | { ok: false; error: string };

export function resolveProductListingDraft(args: {
  rows: ProductLocalizationRow[];
  /** Raw comma-separated field text, used only when mode is "list". */
  regionsInput?: string;
  /**
   * "inherit" leaves the stored footprint alone, "all" sells everywhere,
   * "list" restricts to `regionsInput`. Defaults to "inherit" so a form
   * that never showed the control cannot widen a product's markets.
   */
  regionMode?: "inherit" | "all" | "list";
  /**
   * False for iOS and for subscriptions, where Play/ASC give kit no way
   * to set a per-product footprint. The field is hidden there, and any
   * text left in it is ignored rather than sent and silently dropped.
   */
  supportsSalesRegions?: boolean;
  /** True while editing a product that already exists in kit. */
  editingExisting: boolean;
  /** True once this row's stored values have been loaded into the form. */
  isLoadedRow: boolean;
}): ProductListingDraftResolution {
  // A row the operator started but didn't finish is a mistake, not an
  // instruction to drop it: silently filtering it out would clear the
  // form and lose the text they typed with no error shown.
  const touched = args.rows.filter((row) =>
    [row.locale, row.title, row.description].some((value) => value.trim()),
  );
  if (touched.some((row) => !row.locale.trim() || !row.title.trim())) {
    return {
      ok: false,
      error: "Every language needs both a locale and a title",
    };
  }

  const filled = touched.map((row) => ({
    locale: row.locale.trim(),
    title: row.title.trim(),
    description: row.description.trim() || undefined,
  }));

  const regionMode = args.regionMode ?? "inherit";
  const parsedRegions =
    args.supportsSalesRegions && regionMode === "list"
      ? (args.regionsInput ?? "")
          .split(",")
          .map((code) => code.trim())
          .filter(Boolean)
      : [];
  if (
    args.supportsSalesRegions &&
    regionMode === "list" &&
    !parsedRegions.length
  ) {
    // "Only these regions" with nothing typed would otherwise fall
    // through as "inherit" and quietly ignore the choice.
    return {
      ok: false,
      error:
        "List at least one region, or choose a different sales-region option",
    };
  }

  // Sending a language or region list for a product that already has one
  // REPLACES it, so an operator who typed a single row without loading
  // would silently drop the rest. Make them load first.
  if (
    args.editingExisting &&
    !args.isLoadedRow &&
    (filled.length > 0 || parsedRegions.length > 0 || regionMode !== "inherit")
  ) {
    const replacesRegions =
      args.supportsSalesRegions &&
      (parsedRegions.length > 0 || regionMode !== "inherit");
    return {
      ok: false,
      error: replacesRegions
        ? "Load this product's stored languages and regions first — saving now would replace them"
        : "Load this product's stored languages first — saving now would replace them",
    };
  }

  // A loaded row prefills every stored locale and region, so an empty
  // list there is a deliberate delete-all and must be sent as `[]` for
  // the mutation to clear it. `undefined` is for the untouched cases — a
  // brand-new row, or an existing row nobody opened — where an empty
  // list only means "not specified".
  const sendEmptyAsDeleteAll = args.isLoadedRow;
  return {
    ok: true,
    localizations:
      sendEmptyAsDeleteAll || filled.length > 0 ? filled : undefined,
    // Region modes map to the stored states directly: "all" is a value,
    // "inherit" is the absence of one. A loaded row that switched back
    // to "inherit" sends `[]`, which the mutation stores as null — the
    // same delete-all reasoning as the language list.
    regions: !args.supportsSalesRegions
      ? undefined
      : regionMode === "all"
        ? "all"
        : regionMode === "list"
          ? parsedRegions
          : sendEmptyAsDeleteAll
            ? []
            : undefined,
  };
}
