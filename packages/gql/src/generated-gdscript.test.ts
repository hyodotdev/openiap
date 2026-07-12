import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { IRSchema } from '../codegen/core/types.js';
import { GDScriptPlugin } from '../codegen/plugins/gdscript.js';

const generated = readFileSync(new URL('./generated/types.gd', import.meta.url), 'utf8');

function classSource(className: string, nextClassName: string): string {
  const start = generated.indexOf(`class ${className}:`);
  const end = generated.indexOf(`class ${nextClassName}:`, start + 1);
  return generated.slice(start, end);
}

describe('generated GDScript list decoding', () => {
  it('preserves null for optional enum fields', () => {
    const purchaseError = classSource('PurchaseError', 'PurchaseIOS');

    expect(purchaseError).toContain('var sub_response_code_android: Variant = null');
    expect(purchaseError).toContain('if sub_response_code_android != null:');
    expect(purchaseError).not.toContain('\n\tvar sub_response_code_android: SubResponseCodeAndroid\n');
  });

  it('preserves null for optional enum operation arguments', () => {
    const mutation = classSource('Mutation', 'Subscription');
    const operationStart = mutation.indexOf('class createBillingProgramReportingDetailsAndroidField:');
    const operationEnd = mutation.indexOf('class launchExternalLinkAndroidField:', operationStart);
    const operation = mutation.slice(operationStart, operationEnd);

    expect(operation).toContain('var developer_billing_type: Variant = null');
    expect(operation).toContain('if developer_billing_type != null:');
    expect(operation).not.toContain('\n\t\t\tvar developer_billing_type: DeveloperBillingTypeAndroid\n');
    expect(generated).toContain(
      'static func create_billing_program_reporting_details_android_args(program: BillingProgramAndroid, developer_billing_type: Variant = null)',
    );
    expect(generated).toContain('if developer_billing_type != null:');
    expect(generated).toContain(
      'args["program"] = BILLING_PROGRAM_ANDROID_VALUES[program]',
    );
    expect(generated).toContain(
      'args["developerBillingType"] = DEVELOPER_BILLING_TYPE_ANDROID_VALUES[developer_billing_type]',
    );
  });

  it('builds typed scalar arrays from JSON arrays', () => {
    const source = classSource('ProductRequest', 'PromotionalOfferJWSInputIOS');

    expect(source).toContain('var arr: Array[String] = []');
    expect(source).toContain('if item is String:');
    expect(source).toContain('arr.append(str(item))');
  });

  it('builds typed nested model arrays before assignment', () => {
    const source = classSource('ProductIOS', 'ProductSubscriptionAndroid');

    expect(source).toContain('var arr: Array[SubscriptionOffer] = []');
    expect(source).toContain('arr.append(SubscriptionOffer.from_dict(item))');
    expect(source).toContain('elif item is SubscriptionOffer:');
    expect(source).toContain('var arr: Array[SubscriptionPricingTermsIOS] = []');
  });

  it('rebuilds list arguments in generated operation helpers', () => {
    const source = classSource('Query', 'Mutation');

    expect(source).toContain('var arr: Array[String] = []');
    expect(source).toContain('obj.subscription_ids = arr');
  });

  it('validates enum list values before appending to a typed array', () => {
    const schema: IRSchema = {
      enums: [
        {
          name: 'TestStatus',
          values: [
            { name: 'Unknown', rawValue: 'unknown', legacyAliases: [] },
            { name: 'Active', rawValue: 'active', legacyAliases: [] },
          ],
          isErrorCode: false,
        },
        {
          name: 'StrictStatus',
          values: [{ name: 'Active', rawValue: 'active', legacyAliases: [] }],
          isErrorCode: false,
        },
      ],
      interfaces: [],
      objects: [
        {
          name: 'EnumListHolder',
          fields: [
            {
              name: 'statuses',
              type: {
                kind: 'list',
                nullable: false,
                elementType: {
                  kind: 'enum',
                  name: 'TestStatus',
                  nullable: false,
                },
              },
              isOverride: false,
            },
            {
              name: 'strictStatuses',
              type: {
                kind: 'list',
                nullable: false,
                elementType: {
                  kind: 'enum',
                  name: 'StrictStatus',
                  nullable: false,
                },
              },
              isOverride: false,
            },
          ],
          interfaces: [],
          unions: [],
          isResultUnion: false,
          isSingleFieldArgs: false,
        },
      ],
      inputs: [],
      unions: [],
      operations: [],
      metadata: {
        unionWrapperNames: new Set(),
        futureFieldNames: new Set(),
        platformDefaults: new Map(),
        singleFieldObjects: new Map(),
        unionMembership: new Map(),
        inputsWithRequiredFields: new Set(),
      },
    };
    const source = new GDScriptPlugin({ outputPath: 'types.gd' }).generate(schema);

    expect(source).toContain('if data["statuses"] is Array:');
    expect(source).toContain('arr.append(TEST_STATUS_FROM_STRING.get(item, TestStatus.UNKNOWN))');
    expect(source).toContain('if item is String and STRICT_STATUS_FROM_STRING.has(item):');
    expect(source).toContain('arr.append(STRICT_STATUS_FROM_STRING[item])');
    expect(source).toContain('elif item is int:');
  });
});
