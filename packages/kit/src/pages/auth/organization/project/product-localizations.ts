/**
 * Turns the product form's language rows into the `localizations`
 * argument `upsertProduct` expects.
 *
 * Extracted from the form because the three-way distinction below is the
 * part that has been wrong before — sending `[]` where `undefined` was
 * meant deletes an operator's stored translations, and sending a
 * partially-typed list replaces the rest of them.
 */

export interface ProductLocalizationRow {
  locale: string;
  title: string;
  description: string;
}

export interface ResolvedProductLocalizations {
  /** Ready to send: a list, or `undefined` to leave the stored value alone. */
  localizations?: Array<{
    locale: string;
    title: string;
    description?: string;
  }>;
}

export type ProductLocalizationResolution =
  | ({ ok: true } & ResolvedProductLocalizations)
  | { ok: false; error: string };

export function resolveProductLocalizations(args: {
  rows: ProductLocalizationRow[];
  /** True while editing a product that already exists in kit. */
  editingExisting: boolean;
  /** True once this row's stored languages have been loaded into the form. */
  isLoadedRow: boolean;
}): ProductLocalizationResolution {
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

  // Sending a language list for a product that already has one REPLACES
  // it, so an operator who typed a single row without loading would
  // silently drop the rest. Make them load first.
  if (args.editingExisting && !args.isLoadedRow && filled.length > 0) {
    return {
      ok: false,
      error:
        "Load this product's stored languages first — saving now would replace them",
    };
  }

  // A loaded row prefills every stored locale, so an empty list there is
  // a deliberate delete-all and must be sent as `[]` for the mutation to
  // clear it. `undefined` is for the untouched cases — a brand-new row,
  // or an existing row nobody opened the languages on — where an empty
  // list only means "not specified".
  return {
    ok: true,
    localizations: args.isLoadedRow || filled.length > 0 ? filled : undefined,
  };
}
