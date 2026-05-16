export function usdPriceToMicros(raw: string): number | undefined {
  const value = raw.trim();
  if (value === "") return undefined;

  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(value);
  if (!match) return undefined;

  const units = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(6, "0"));
  const micros = units * 1_000_000n + fraction;
  if (micros <= 0n || micros > BigInt(Number.MAX_SAFE_INTEGER)) {
    return undefined;
  }
  return Number(micros);
}
