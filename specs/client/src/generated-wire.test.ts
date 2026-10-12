import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// One payload every generated language must decode and re-encode the same way:
// flat union members tagged with `__typename` (including the nested
// `latestTransaction`), and input defaults applied to explicit JSON nulls.
const purchaseIOS = {
  __typename: "PurchaseIOS",
  id: "txn-ios",
  isAutoRenewing: false,
  productId: "premium",
  purchaseState: "purchased",
  quantity: 1,
  store: "apple",
  storeId: "apple",
  transactionDate: 1720000000000,
  transactionId: "txn-ios",
};
const purchaseAndroid = {
  __typename: "PurchaseAndroid",
  id: "order-1",
  isAutoRenewing: true,
  productId: "monthly",
  purchaseState: "purchased",
  purchaseToken: "token",
  quantity: 1,
  store: "google",
  storeId: "play",
  transactionDate: 1720000000000,
};
const unions = {
  purchases: [purchaseIOS, purchaseAndroid],
  verify: {
    __typename: "VerifyPurchaseResultIOS",
    isValid: true,
    jwsRepresentation: "jws",
    latestTransaction: purchaseIOS,
    receiptData: "receipt",
  },
};
const input = {
  ...unions,
  choice: { billingProgram: null, playBillingChoiceImageLayout: null },
  messages: { categories: null },
  request: { skus: ["premium"], type: null },
};
const expected = {
  ...unions,
  choice: {
    billingProgram: "billing-choice",
    playBillingChoiceImageLayout: "rectangular-four-by-one",
  },
  messages: { categories: ["transactional"] },
  request: { skus: ["premium"], type: "in-app" },
};

const generatedDir = new URL("./generated/", import.meta.url).pathname;
const workDir = mkdtempSync(join(tmpdir(), "openiap-wire-"));
afterAll(() => rmSync(workDir, { recursive: true, force: true }));

const has = (command: string, args: string[], output = ""): boolean => {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0 && result.stdout.includes(output);
};

const run = (
  command: string,
  args: string[],
  stdin?: string,
  cwd = workDir,
): string => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    input: stdin,
    maxBuffer: 1 << 24,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result.stdout;
};

// Dart emits explicit nulls and the others omit them; both mean "absent".
const withoutNulls = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== null)
        .map(([key, entry]) => [key, withoutNulls(entry)]),
    );
  }
  return value;
};

type RoundTrip = (payload: string) => string;

const swift: RoundTrip = (() => {
  let binary: string | null = null;
  return (payload) => {
    if (!binary) {
      // `.sortedKeys` puts `__typename` first, as MAUI's NSObjectJsonBridge does
      // before System.Text.Json reads it; production Swift JSON has no key order.
      writeFileSync(
        join(workDir, "main.swift"),
        `import Foundation
struct Wire: Codable {
    let choice: GetBillingChoiceInfoParamsAndroid
    let messages: InAppMessageParamsAndroid
    let purchases: [Purchase]
    let request: ProductRequest
    let verify: VerifyPurchaseResult
}
let wire = try JSONDecoder().decode(Wire.self, from: FileHandle.standardInput.readDataToEndOfFile())
let encoder = JSONEncoder()
encoder.outputFormatting = .sortedKeys
FileHandle.standardOutput.write(try encoder.encode(wire))
`,
      );
      binary = join(workDir, "swift-wire");
      run("swiftc", [
        join(generatedDir, "Types.swift"),
        join(workDir, "main.swift"),
        "-o",
        binary,
      ]);
    }
    return run(binary, [], payload);
  };
})();

const dart: RoundTrip = (payload) => {
  copyFileSync(join(generatedDir, "types.dart"), join(workDir, "types.dart"));
  writeFileSync(
    join(workDir, "wire.dart"),
    `import 'dart:convert';
import 'dart:io';
import 'types.dart';

void main() {
  final json = jsonDecode(stdin.readLineSync()!) as Map<String, dynamic>;
  Map<String, dynamic> read(String key) => json[key] as Map<String, dynamic>;
  stdout.write(jsonEncode({
    'choice': GetBillingChoiceInfoParamsAndroid.fromJson(read('choice')).toJson(),
    'messages': InAppMessageParamsAndroid.fromJson(read('messages')).toJson(),
    'purchases': (json['purchases'] as List<dynamic>).map((e) => Purchase.fromJson(e as Map<String, dynamic>).toJson()).toList(),
    'request': ProductRequest.fromJson(read('request')).toJson(),
    'verify': VerifyPurchaseResult.fromJson(read('verify')).toJson(),
  }));
}
`,
  );
  return run("dart", ["wire.dart"], payload);
};

const csharp: RoundTrip = (() => {
  let built = false;
  const projectDir = join(workDir, "csharp");
  return (payload) => {
    if (!built) {
      mkdirSync(projectDir, { recursive: true });
      copyFileSync(
        join(generatedDir, "Types.cs"),
        join(projectDir, "Types.cs"),
      );
      writeFileSync(
        join(projectDir, "Wire.csproj"),
        `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <LangVersion>12.0</LangVersion>
  </PropertyGroup>
</Project>
`,
      );
      // Same serializer options as OpenIap.Maui's JsonOptions.Default.
      writeFileSync(
        join(projectDir, "Program.cs"),
        `using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using OpenIap;

var options = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
};
var input = JsonNode.Parse(Console.In.ReadToEnd())!;
JsonNode? RoundTrip<T>(string key) => JsonSerializer.SerializeToNode(input[key]!.Deserialize<T>(options), options);
Console.Write(new JsonObject
{
    ["choice"] = RoundTrip<GetBillingChoiceInfoParamsAndroid>("choice"),
    ["messages"] = RoundTrip<InAppMessageParamsAndroid>("messages"),
    ["purchases"] = RoundTrip<List<Purchase>>("purchases"),
    ["request"] = RoundTrip<ProductRequest>("request"),
    ["verify"] = RoundTrip<VerifyPurchaseResult>("verify"),
}.ToJsonString());
`,
      );
      run(
        "dotnet",
        ["build", "-nologo", "-v", "q", "-o", join(projectDir, "out")],
        undefined,
        projectDir,
      );
      built = true;
    }
    return run("dotnet", [join(projectDir, "out", "Wire.dll")], payload);
  };
})();

const languages: Array<[string, RoundTrip, boolean]> = [
  ["Swift", swift, has("swiftc", ["--version"])],
  ["Dart", dart, has("dart", ["--version"])],
  ["C#", csharp, has("dotnet", ["--list-sdks"], "10.")],
];
const available = languages.filter(([, , present]) => present);

describe("generated wire contract across languages", () => {
  it.runIf(Boolean(process.env.CI))(
    "runs every language toolchain in CI",
    () => {
      expect(available.map(([name]) => name)).toEqual(
        languages.map(([name]) => name),
      );
    },
  );

  for (const [name, roundTrip, present] of languages) {
    it.skipIf(!present)(
      `${name} decodes and re-encodes the shared payload`,
      () => {
        expect(
          withoutNulls(JSON.parse(roundTrip(JSON.stringify(input)))),
        ).toEqual(expected);
      },
      300_000,
    );
  }

  it.skipIf(available.length < 2)(
    "every language reads every other language’s output",
    () => {
      for (const [producer, produce] of available) {
        const produced = produce(JSON.stringify(input));
        for (const [consumer, consume] of available) {
          expect(
            withoutNulls(JSON.parse(consume(produced))),
            `${producer} → ${consumer}`,
          ).toEqual(expected);
        }
      }
    },
    300_000,
  );
});
