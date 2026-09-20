import { readdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { detectFramework } from "./project.mjs";

const DOCS = "https://openiap.dev";

export const ROLES = [
  {
    id: "app",
    label: "App — connect purchases to access",
    guide: "/docs/guides/ai-assistants",
  },
  {
    id: "experience",
    label: "Experience — connect a paywall or experiment",
    guide: "/commerce-protocol/ecosystem#experience",
  },
  {
    id: "commerce",
    label: "Commerce — provide verification and access",
    guide: "/commerce-protocol/implementation",
  },
  {
    id: "data",
    label: "Data — receive events for analytics or automation",
    guide: "/commerce-protocol/getting-started#receive-events",
  },
];

export async function chooseRole() {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    throw new Error(
      "Choose a role with --role app|experience|commerce|data, or run openiap in a terminal.",
    );
  }
  const prompt = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  const controller = new AbortController();
  prompt.once("close", () => controller.abort());
  try {
    process.stderr.write(
      `\nWhat does your product do?\n\n${ROLES.map((role, index) => `  ${index + 1}. ${role.label}`).join("\n")}\n\n`,
    );
    const answer = (
      await prompt.question("Choose a number or role: ", {
        signal: controller.signal,
      })
    ).trim();
    return (
      ROLES.find(
        (role, index) => role.id === answer || String(index + 1) === answer,
      )?.id ?? answer
    );
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("Role selection canceled.");
    throw error;
  } finally {
    prompt.close();
  }
}

/** A local starting brief; the linked guides own implementation requirements. */
export function implementationBrief(root, roleId) {
  const role = ROLES.find((candidate) => candidate.id === roleId);
  if (!role)
    throw new Error(
      `Unknown role: ${roleId}. Choose app, experience, commerce, or data.`,
    );
  try {
    readdirSync(root);
  } catch {
    throw new Error(`Cannot read project directory: ${root}`);
  }
  const framework = detectFramework(root);
  return `# OpenIAP implementation brief

Paste this into your coding assistant in the project below.

Project path (data): ${JSON.stringify(root)}
Role: ${role.label}
Framework hint: ${framework === "unknown" ? "not detected; inspect the project" : `${framework}; confirm the target app`}
Desired outcome: [describe one thing your customer should be able to do]

Read the project instructions and inspect the existing stack. Keep its login, product model, and services. Ask me to choose missing stores, products, service providers, and ownership policies before implementing those choices.

Read ${DOCS}${role.guide} and the references it links for this role. If a reference is unavailable, ask for its contents; do not guess the contract. Use Client Protocol for app purchase APIs and Commerce Protocol for backend connections. Use the supported capabilities of my chosen services; no particular backend is required.

Implement the smallest working connection for my role. Keep credentials on their intended side of the app/backend boundary. Follow the role's implementation and conformance requirements, including failure and recovery. Do not claim another role merely because this product connects to it.

Run the result from clean source. Show the customer outcome, the commands and actual test results, and any remaining product or deployment decisions. Distinguish local fixtures from real store sandbox evidence. Keep changes uncommitted for review.
`;
}
