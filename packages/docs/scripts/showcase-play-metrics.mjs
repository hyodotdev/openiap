/** "1.2K" -> 1200, "3M" -> 3000000, "55" -> 55 */
function parseCompact(value) {
  const match = /^([\d.,]+)\s*([KMB])?/i.exec(value.trim());
  if (!match) return undefined;
  const base = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(base)) return undefined;
  const scale = { k: 1e3, m: 1e6, b: 1e9 }[match[2]?.toLowerCase()] ?? 1;
  return Math.round(base * scale);
}

// Text nodes that end in "reviews" but are chrome, not a count.
const PLAY_REVIEW_CHROME = /^(ratings and reviews|reviews|all reviews)$/i;

// Missing reviews can mean zero; a missing download count means markup drift.
export function parsePlayMetrics(html, packageName = 'app') {
  const installs =
    />([\d.,]+\s*[KMB]?\+)<\/div><div class="[^"]+">Downloads</i.exec(
      html
    )?.[1];
  if (installs === undefined) {
    throw new Error(
      `install count not found for ${packageName} — Play markup likely changed`
    );
  }

  const reviews = /">([\d.,]+\s*[KMB]?)\s*reviews</i.exec(html)?.[1];
  if (reviews !== undefined) {
    const parsed = parseCompact(reviews);
    if (parsed === undefined) {
      throw new Error(
        `review count "${reviews}" not parseable for ${packageName}`
      );
    }
    return { ratings: parsed, installs: parseCompact(installs) };
  }

  const orphaned = [...html.matchAll(/>([^<]{0,40}?reviews)</gi)]
    .map((match) => match[1].trim())
    .filter((text) => !PLAY_REVIEW_CHROME.test(text))
    .filter((text) => /\d/.test(text));

  if (orphaned.length > 0) {
    throw new Error(
      `found review element "${orphaned[0]}" but could not read its count for ${packageName}`
    );
  }

  return { ratings: 0, installs: parseCompact(installs) };
}
