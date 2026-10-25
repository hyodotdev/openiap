import { readFile, writeFile } from "node:fs/promises";
import { commands } from "./kit-commands.mjs";

const operations = [];
for (const [command, target, effect] of commands) {
  const [module, name] = target.split(":");
  const exports = await import(`../../kit/convex/${module}.ts`);
  const fn = exports[name];
  if (!fn?.isPublic || typeof fn.exportArgs !== "function") {
    throw new Error(`${target} is not a public Convex function`);
  }
  const kind = fn.isQuery ? "query" : fn.isMutation ? "mutation" : "action";
  operations.push({
    command,
    target,
    kind,
    effect: effect ?? (kind === "query" ? "read" : "write"),
    args:
      JSON.parse(fn.exportArgs()).type === "any"
        ? { type: "object", value: {} }
        : JSON.parse(fn.exportArgs()),
  });
}
const file = new URL("../src/kit/operations.json", import.meta.url);
const contents = `${JSON.stringify(operations, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if ((await readFile(file, "utf8")) !== contents) {
    throw new Error("Run bun packages/cli/scripts/generate-kit-commands.mjs");
  }
} else {
  await writeFile(file, contents);
}
