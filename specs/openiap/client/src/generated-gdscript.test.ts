import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nullableEnumListSchema } from "../codegen/fixtures/nullable-enum-list.js";
import { GDScriptPlugin } from "../codegen/plugins/gdscript.js";

const generated = readFileSync(
  new URL("./generated/types.gd", import.meta.url),
  "utf8",
);
const nullableEnumListFixture = readFileSync(
  new URL(
    "../../../../libraries/godot-iap/Example/tests/generated_nullable_enum_list_types.gd",
    import.meta.url,
  ),
  "utf8",
);

function classSource(className: string, nextClassName: string): string {
  const start = generated.indexOf(`class ${className}:`);
  const end = generated.indexOf(`class ${nextClassName}:`, start + 1);
  return generated.slice(start, end);
}

describe("generated GDScript list decoding", () => {
  it("preserves null for optional enum fields", () => {
    const purchaseError = classSource("PurchaseError", "PurchaseIOS");

    expect(purchaseError).toContain(
      "var sub_response_code_android: Variant = null",
    );
    expect(purchaseError).toContain("if sub_response_code_android != null:");
    expect(purchaseError).not.toContain(
      "\n\tvar sub_response_code_android: SubResponseCodeAndroid\n",
    );
  });

  it("preserves null for optional enum operation arguments", () => {
    const mutation = classSource("Mutation", "Subscription");
    const operationStart = mutation.indexOf(
      "class createBillingProgramReportingDetailsAndroidField:",
    );
    const operationEnd = mutation.indexOf(
      "class launchExternalLinkAndroidField:",
      operationStart,
    );
    const operation = mutation.slice(operationStart, operationEnd);

    expect(operation).toContain("var developer_billing_type: Variant = null");
    expect(operation).toContain("if developer_billing_type != null:");
    expect(operation).not.toContain(
      "\n\t\t\tvar developer_billing_type: DeveloperBillingTypeAndroid\n",
    );
    expect(generated).toContain(
      "static func create_billing_program_reporting_details_android_args(program: BillingProgramAndroid, developer_billing_type: Variant = null)",
    );
    expect(generated).toContain("if developer_billing_type != null:");
    expect(generated).toContain(
      'args["program"] = BILLING_PROGRAM_ANDROID_VALUES[program]',
    );
    expect(generated).toContain(
      'args["developerBillingType"] = DEVELOPER_BILLING_TYPE_ANDROID_VALUES[developer_billing_type]',
    );
  });

  it("builds typed scalar arrays from JSON arrays", () => {
    const source = classSource("ProductRequest", "PromotionalOfferJWSInputIOS");

    expect(source).toContain("var arr: Array[String] = []");
    expect(source).toContain("if item is String:");
    expect(source).toContain("arr.append(str(item))");
  });

  it("builds typed nested model arrays before assignment", () => {
    const source = classSource("ProductIOS", "ProductSubscriptionAndroid");

    expect(source).toContain("var arr: Array[SubscriptionOffer] = []");
    expect(source).toContain(
      "var decoded_subscription_offer = SubscriptionOffer.from_dict(item, report_errors)",
    );
    expect(source).toContain("if decoded_subscription_offer == null:");
    expect(source).toContain("return null");
    expect(source).toContain("arr.append(decoded_subscription_offer)");
    expect(source).toContain("elif item is SubscriptionOffer:");
    expect(source).toContain(
      "var arr: Array[SubscriptionPricingTermsIOS] = []",
    );
  });

  it("rebuilds list arguments in generated operation helpers", () => {
    const source = classSource("Query", "Mutation");

    expect(source).toContain("var arr: Array[String] = []");
    expect(source).toContain("obj.subscription_ids = arr");
  });

  it("validates enum list values before appending to a typed array", () => {
    const source = new GDScriptPlugin({
      outputPath: "generated_nullable_enum_list_types.gd",
    }).generate(nullableEnumListSchema());

    expect(nullableEnumListFixture).toBe(source);

    expect(source).toContain(
      "## Status values from the schema. Preserves every documentation line. @see https://openiap.dev/docs/types",
    );
    expect(source).toContain('if data["statuses"] is Array:');
    expect(source).toContain(
      "if item is String and TEST_STATUS_FROM_STRING.has(item):",
    );
    expect(source).toContain("arr.append(TEST_STATUS_FROM_STRING[item])");
    expect(source).toContain(
      "elif item is int and TEST_STATUS_VALUES.has(item):",
    );
    expect(source).toContain("arr.append(TestStatus.UNKNOWN)");
    expect(source).toContain(
      "if item is String and STRICT_STATUS_FROM_STRING.has(item):",
    );
    expect(source).toContain("arr.append(STRICT_STATUS_FROM_STRING[item])");
    expect(source).toContain(
      "elif item is int and STRICT_STATUS_VALUES.has(item):",
    );
    expect(source).toContain(
      'push_error("Invalid StrictStatus list value for strictStatuses")',
    );
    expect(source).toContain("return null");
    expect(source).toContain(
      "var nullable_strict_statuses: Array[Variant] = []",
    );
    const nullableStrictStart = source.indexOf(
      'if data["nullableStrictStatuses"] is Array:',
    );
    const nullableStrictEnd = source.indexOf(
      "obj.nullable_strict_statuses = arr",
      nullableStrictStart,
    );
    const nullableStrictDecoder = source.slice(
      nullableStrictStart,
      nullableStrictEnd,
    );
    expect(nullableStrictDecoder).toContain("var arr: Array[Variant] = []");
    expect(nullableStrictDecoder).toContain(
      "if item == null:\n\t\t\t\t\t\tarr.append(null)",
    );
    expect(nullableStrictDecoder).toContain(
      "else:\n\t\t\t\t\t\tarr.append(null)",
    );
    expect(source).toContain("var nullable_labels: Array[Variant] = []");
    expect(source).toContain(
      'if data["nullableLabels"] is Array:\n\t\t\t\tvar arr: Array[Variant] = []',
    );
  });
});
