const reserved = new Set([
  "apiKey",
  "sourceAuth",
  "requestIp",
  "correlationId",
  "now",
]);

function jsonSchema(validator) {
  if (["string", "id"].includes(validator.type)) return { type: "string" };
  if (["number", "float64"].includes(validator.type)) return { type: "number" };
  if (validator.type === "boolean") return { type: "boolean" };
  if (validator.type === "null") return { type: "null" };
  if (validator.type === "literal") return { const: validator.value };
  if (validator.type === "union")
    return { anyOf: validator.value.map(jsonSchema) };
  if (validator.type === "array")
    return { type: "array", items: jsonSchema(validator.value) };
  if (validator.type === "object") {
    return {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(validator.value).map(([key, field]) => [
          key,
          jsonSchema(field.fieldType),
        ]),
      ),
      required: Object.entries(validator.value)
        .filter(([, field]) => !field.optional)
        .map(([key]) => key),
      additionalProperties: false,
    };
  }
  if (validator.type === "record")
    return {
      type: "object",
      additionalProperties: jsonSchema(
        validator.values.fieldType ?? validator.values,
      ),
    };
  return {};
}

export function commandSchema(operation) {
  const fields = Object.fromEntries(
    Object.entries(operation.args.value ?? {}).filter(
      ([key]) => !reserved.has(key),
    ),
  );
  if (operation.args.value?.apiKey)
    fields.projectId = { fieldType: { type: "string" }, optional: false };
  return {
    command: operation.command,
    effect: operation.effect,
    inputSchema: jsonSchema({ type: "object", value: fields }),
    aliases: {
      "--project": "projectId",
      "--org": "organizationId",
      "--key": "keyId",
    },
    options: [
      "--file",
      "--json",
      "--base-url",
      "--yes",
      "--output",
      ...(operation.command === "sync products"
        ? ["--dry-run", "--apply", "--wait", "--timeout"]
        : []),
      ...(["credentials google", "credentials apple"].includes(
        operation.command,
      )
        ? ["--credential-file"]
        : []),
      ...(operation.command === "files upload" ? ["--path"] : []),
    ],
  };
}
