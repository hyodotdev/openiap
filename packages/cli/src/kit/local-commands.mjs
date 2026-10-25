import { SETUP_FRAMEWORKS } from "./guides.mjs";
const string = (optional = false) => ({
  fieldType: { type: "string" },
  optional,
});
const local = (command, fields, effect = "read") => ({
  command,
  kind: "local",
  effect,
  args: { type: "object", value: fields },
});

export const localCommands = [
  local("health", {}),
  local("setup", {
    framework: {
      fieldType: {
        type: "union",
        value: SETUP_FRAMEWORKS.map((value) => ({ type: "literal", value })),
      },
      optional: false,
    },
    productId: string(true),
  }),
  local(
    "credentials google",
    { projectId: string(), organizationId: string(), credentialFile: string() },
    "write",
  ),
  local(
    "files upload",
    {
      organizationId: string(),
      projectId: string(true),
      purpose: string(),
      path: string(),
      description: string(true),
    },
    "write",
  ),
  local("troubleshoot", { projectId: string() }),
  local("inspect", { projectId: string() }),
  local("simulate purchase", { platform: string(), productId: string() }),
  local(
    "simulate webhook",
    { platform: string(), projectId: string() },
    "write",
  ),
];
