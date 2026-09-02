import Ajv from "ajv/dist/2020";
import type { ValidateFunction } from "ajv/dist/2020";
import HTTP_BINDING from "openiap-commerce-protocol/generated/bindings/http-binding.json";
import bundleSchema from "openiap-commerce-protocol/generated/schemas/commerce-protocol.bundle.schema.json";

// One compiled validator set for the whole process. The bundle resolves no
// external reference, so compilation is offline and deterministic.
const ajv = new Ajv({ strict: true, allErrors: false });
ajv.addSchema(bundleSchema, "bundle");

const validators = new Map<string, ValidateFunction>();
for (const operation of HTTP_BINDING.operations) {
  if (!operation.input) continue;
  const validate = ajv.getSchema(`bundle${operation.input}`);
  if (!validate) {
    throw new Error(`Bundle is missing ${operation.input}`);
  }
  validators.set(operation.name, validate);
}

/**
 * Returns null when the input satisfies the operation's generated schema,
 * otherwise a short human-readable reason with member paths only — never
 * submitted values.
 */
export function validateOperationInput(
  operationName: string,
  input: unknown,
): string | null {
  const validate = validators.get(operationName);
  if (!validate) return null;
  if (validate(input)) return null;
  const error = validate.errors?.[0];
  if (!error) return "input is invalid";
  const at = error.instancePath ? ` at ${error.instancePath}` : "";
  return `input${at} ${error.message ?? "is invalid"}`;
}
