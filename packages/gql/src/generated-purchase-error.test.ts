import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const generatedDir = resolve(currentDir, "generated");

function readGenerated(fileName: string): string {
  return readFileSync(resolve(generatedDir, fileName), "utf8");
}

describe("generated PurchaseError diagnostics", () => {
  it("keeps Android QueryProduct diagnostics in generated TypeScript types", () => {
    const source = readGenerated("types.ts");

    expect(source).toContain("responseCode?: (number | null);");
    expect(source).toContain("productIds?: (string[] | null);");
    expect(source).toContain("productType?: (string | null);");
    expect(source).toContain("isEmptyProductList?: (boolean | null);");
  });

  it("keeps Android QueryProduct diagnostics in generated C# types", () => {
    const source = readGenerated("Types.cs");

    expect(source).toContain('[JsonPropertyName("responseCode")]');
    expect(source).toContain("public int? ResponseCode { get; init; }");
    expect(source).toContain('[JsonPropertyName("productIds")]');
    expect(source).toContain("public IReadOnlyList<string>? ProductIds { get; init; }");
    expect(source).toContain('[JsonPropertyName("productType")]');
    expect(source).toContain("public string? ProductType { get; init; }");
    expect(source).toContain('[JsonPropertyName("isEmptyProductList")]');
    expect(source).toContain("public bool? IsEmptyProductList { get; init; }");
  });
});
