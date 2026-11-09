// The published declarations of the React Native and Expo SDKs, read from
// source as data: a TypeScript program type-checks the sources (never running
// them) and emits their declarations, so inferred types are concrete. Starting
// from each entry point, the walk keeps what a consumer can reach (exported
// names, the types and imports they use, and parameter defaults) across
// modules. A change there is a public contract change; a body-only refactor
// or an internal export is not.

import { existsSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { isDeepStrictEqual } from "node:util";
import ts from "typescript";
import { GENERATED_SYNC_EDGES } from "../specs/client/generated-sync-manifest.mjs";

// The kepler entries are the Vega builds' own copy of the API.
export const publicEntryPoints = [
  "libraries/react-native-iap/src/index.ts",
  "libraries/react-native-iap/src/index.kepler.ts",
  "libraries/expo-iap/src/index.ts",
  "libraries/expo-iap/src/index.kepler.ts",
];
// package.json fields that choose which module a consumer loads.
const entryFields = [
  "main",
  "module",
  "types",
  "typings",
  "react-native",
  "source",
  "exports",
];
// A synced mirror is authored in its source, so report the source.
const syncedSource = new Map(
  GENERATED_SYNC_EDGES.map(({ path, source }) => [path, source]),
);

const normalize = (text) => text.replace(/\s+/g, " ").trim();
const hasModifier = (node, kind) =>
  (ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined)?.some(
    (modifier) => modifier.kind === kind,
  ) ?? false;

function declaredNames(statement) {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
    );
  }
  return statement.name && ts.isIdentifier(statement.name)
    ? [statement.name.text]
    : [];
}

// Declaration emit drops parameter defaults, which are public too: those of
// exported functions and of the members of exported classes and objects.
function parameterDefaults(source, path) {
  const defaults = new Map();
  const collect = (name, label, parameters) => {
    const values = [];
    for (const parameter of parameters) {
      parameter.forEachChild(function visit(node) {
        if (
          (ts.isParameter(node) || ts.isBindingElement(node)) &&
          node.initializer
        ) {
          values.push(`${node.name.getText()}=${node.initializer.getText()}`);
        }
        node.forEachChild(visit);
      });
      if (parameter.initializer)
        values.push(
          `${parameter.name.getText()}=${parameter.initializer.getText()}`,
        );
    }
    if (values.length) {
      const previous = defaults.get(name);
      const value = `${label}(${values.join(", ")})`;
      defaults.set(name, previous ? `${previous}; ${value}` : value);
    }
  };
  const functionLike = (node) =>
    node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));
  const members = (name, nodes) => {
    for (const member of nodes) {
      if (
        hasModifier(member, ts.SyntaxKind.PrivateKeyword) ||
        (member.name && ts.isPrivateIdentifier(member.name))
      )
        continue;
      const label = member.name?.getText() ?? "constructor";
      if (ts.isFunctionLike(member)) collect(name, label, member.parameters);
      else if (functionLike(member.initializer))
        collect(name, label, member.initializer.parameters);
    }
  };
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      collect(statement.name.text, "", statement.parameters);
    }
    if (ts.isClassDeclaration(statement) && statement.name) {
      members(statement.name.text, statement.members);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        let value = declaration.initializer;
        while (
          value &&
          (ts.isAsExpression(value) ||
            ts.isSatisfiesExpression(value) ||
            ts.isParenthesizedExpression(value))
        )
          value = value.expression;
        if (!ts.isIdentifier(declaration.name) || !value) continue;
        const name = declaration.name.text;
        if (functionLike(value)) collect(name, "", value.parameters);
        if (ts.isObjectLiteralExpression(value))
          members(name, value.properties);
        if (ts.isClassExpression(value)) members(name, value.members);
      }
    }
  }
  return defaults;
}

function parseModule(path, source, emitted) {
  // A .d.ts module is already declarations.
  const output = path.endsWith(".d.ts")
    ? source
    : (emitted ??
      ts.transpileDeclaration(source, {
        fileName: path,
        reportDiagnostics: false,
        compilerOptions: { removeComments: false },
      }).outputText);
  const file = ts.createSourceFile(
    "published.d.ts",
    output,
    ts.ScriptTarget.Latest,
    true,
  );
  const module = {
    declarations: new Map(),
    imports: new Map(),
    exported: new Map(),
    stars: [],
    // `declare global` and `declare module` change consumers' types too.
    augmentations: [],
    sideEffects: [],
    defaults: parameterDefaults(source, path),
  };
  for (const statement of file.statements) {
    if (
      ts.isModuleDeclaration(statement) &&
      (ts.isStringLiteral(statement.name) ||
        statement.flags & ts.NodeFlags.GlobalAugmentation)
    ) {
      module.augmentations.push(normalize(statement.getFullText()));
    } else if (ts.isImportDeclaration(statement)) {
      const specifier = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (!clause) module.sideEffects.push(specifier);
      if (clause?.name)
        module.imports.set(clause.name.text, { specifier, name: "default" });
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings))
        module.imports.set(bindings.name.text, { specifier, name: "*" });
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          module.imports.set(element.name.text, {
            specifier,
            name: (element.propertyName ?? element.name).text,
          });
        }
      }
    } else if (ts.isExportDeclaration(statement)) {
      // `export type` publishes no runtime value, so it is part of the shape.
      const specifier = statement.moduleSpecifier?.text;
      const clause = statement.exportClause;
      const typeOnly = statement.isTypeOnly;
      if (!clause) {
        if (specifier) module.stars.push({ specifier, typeOnly });
      } else if (ts.isNamespaceExport(clause)) {
        module.exported.set(clause.name.text, {
          specifier,
          name: "*",
          typeOnly,
        });
      } else {
        for (const element of clause.elements) {
          const name = (element.propertyName ?? element.name).text;
          const elementTypeOnly = typeOnly || element.isTypeOnly;
          module.exported.set(
            element.name.text,
            specifier
              ? { specifier, name, typeOnly: elementTypeOnly }
              : { local: name, typeOnly: elementTypeOnly },
          );
        }
      }
    } else if (ts.isExportAssignment(statement)) {
      module.exported.set("default", { local: statement.expression.getText() });
    } else {
      for (const name of declaredNames(statement)) {
        module.declarations.set(name, [
          ...(module.declarations.get(name) ?? []),
          statement,
        ]);
        if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
          const exportedAs = hasModifier(
            statement,
            ts.SyntaxKind.DefaultKeyword,
          )
            ? "default"
            : name;
          module.exported.set(exportedAs, { local: name });
        }
      }
    }
  }
  return module;
}

/** What `names` of a parsed module publish, plus the modules they come from. */
function publishedEntries(module, names) {
  const entries = new Map();
  // A side-effect import loads only the imported module's augmentations.
  const edges = module.sideEffects.map((specifier) => [specifier, ""]);
  const all = names.has("*");
  if (module.augmentations.length)
    entries.set("augmentations", module.augmentations.join("\n"));
  for (const { specifier, typeOnly } of module.stars) {
    entries.set(`export * from ${specifier}`, typeOnly ? "type" : "value");
    for (const name of all ? ["*"] : names) {
      if (!module.exported.has(name)) edges.push([specifier, name]);
    }
  }
  const visited = new Set();
  const visit = (name) => {
    if (visited.has(name)) return;
    visited.add(name);
    const statements = module.declarations.get(name);
    if (statements) {
      const defaults = module.defaults.get(name);
      entries.set(
        `declaration ${name}`,
        normalize(
          statements.map((statement) => statement.getFullText()).join(""),
        ) + (defaults ? ` defaults(${defaults})` : ""),
      );
      for (const statement of statements) {
        statement.forEachChild(function walk(node) {
          if (ts.isIdentifier(node)) visit(node.text);
          node.forEachChild(walk);
        });
      }
      return;
    }
    const imported = module.imports.get(name);
    if (imported) {
      entries.set(
        `import ${name}`,
        `${imported.name} from ${imported.specifier}`,
      );
      edges.push([imported.specifier, imported.name]);
    }
  };
  for (const name of all ? module.exported.keys() : names) {
    const target = module.exported.get(name);
    if (!target) continue;
    const kind = target.typeOnly ? "type " : "";
    if (target.specifier) {
      entries.set(
        `export ${name}`,
        `${kind}${target.name} from ${target.specifier}`,
      );
      edges.push([target.specifier, target.name]);
      continue;
    }
    entries.set(`export ${name}`, `${kind}${target.local}`);
    visit(target.local);
  }
  return { entries, edges };
}

function resolveModule(from, specifier, read) {
  if (!specifier.startsWith(".")) return undefined;
  const base = posix
    .normalize(posix.join(posix.dirname(from), specifier))
    .replace(/\.js$/, "");
  return [".ts", ".tsx", ".d.ts", "/index.ts", "/index.tsx", ""]
    .map((suffix) => base + suffix)
    .find((path) => /\.tsx?$/.test(path) && read(path) !== undefined);
}

// TypeScript's own lib files never change within a run; parse them once.
const libraryFiles = new Map();

const programOptions = {
  declaration: true,
  emitDeclarationOnly: true,
  removeComments: false,
  skipLibCheck: true,
  strict: true,
  noEmitOnError: false,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  resolveJsonModule: true,
  esModuleInterop: true,
  types: [],
};

// A bare specifier's package, and the @types package that may type it.
function requiredPackages(specifier) {
  const name = specifier
    .split("/")
    .slice(0, specifier.startsWith("@") ? 2 : 1)
    .join("/");
  return [name, `@types/${name.replace(/^@/, "").replace("/", "__")}`];
}

/**
 * Type-checked declarations for every module the entry points reach. Sources
 * come from `read`; dependency types come from `dependencies`, the checkout's
 * own installed node_modules. `requireDependencies` names the packages that
 * must resolve (or is `true` for all), so a missing install fails the check
 * instead of turning a public type into `any`.
 */
export function emittedDeclarations(
  read,
  { dependencies = process.cwd(), requireDependencies = false } = {},
) {
  const root = "/openiap/";
  const libraries = posix.dirname(ts.getDefaultLibFilePath(programOptions));
  const local = (file) =>
    file.startsWith(root) ? file.slice(root.length) : undefined;
  const installed = (file) => local(file)?.includes("node_modules/");
  const real = (file) => posix.join(dependencies, local(file));
  const host = ts.createCompilerHost(programOptions, true);
  host.getCurrentDirectory = () => root;
  host.realpath = (file) => file;
  host.fileExists = (file) =>
    local(file) === undefined
      ? file.startsWith(libraries) && ts.sys.fileExists(file)
      : installed(file)
        ? existsSync(real(file))
        : read(local(file)) !== undefined;
  host.readFile = (file) => {
    if (local(file) === undefined)
      return file.startsWith(libraries) ? ts.sys.readFile(file) : undefined;
    if (!installed(file)) return read(local(file));
    try {
      return readFileSync(real(file), "utf8");
    } catch {
      return undefined;
    }
  };
  host.directoryExists = (directory) =>
    local(directory) === undefined
      ? ts.sys.directoryExists(directory)
      : !installed(`${directory}/`) || existsSync(real(directory));
  host.getDirectories = (directory) =>
    local(directory) !== undefined && existsSync(real(directory))
      ? ts.sys.getDirectories(real(directory))
      : [];
  host.getSourceFile = (file, version) => {
    const library = local(file) === undefined;
    if (library && libraryFiles.has(file)) return libraryFiles.get(file);
    const text = host.readFile(file);
    const source =
      text === undefined
        ? undefined
        : ts.createSourceFile(file, text, version, true);
    if (library) libraryFiles.set(file, source);
    return source;
  };
  const program = ts.createProgram(
    publicEntryPoints
      .filter((entry) => read(entry) !== undefined)
      .map((entry) => root + entry),
    programOptions,
    host,
  );
  if (requireDependencies) {
    const missing = new Set(
      ts
        .getPreEmitDiagnostics(program)
        .filter(
          ({ code, file }) =>
            [2307, 2792].includes(code) &&
            file &&
            local(file.fileName) !== undefined &&
            !installed(file.fileName),
        )
        .map(
          ({ messageText }) =>
            /'([^']+)'/.exec(
              ts.flattenDiagnosticMessageText(messageText, " "),
            )?.[1],
        )
        .filter(
          (specifier) =>
            specifier &&
            !specifier.startsWith(".") &&
            (requireDependencies === true ||
              requiredPackages(specifier).some((name) =>
                requireDependencies.has(name),
              )),
        ),
    );
    if (missing.size) {
      throw new Error(
        `Install the SDK dependencies before checking public declarations; unresolved: ${[...missing].join(", ")}`,
      );
    }
  }
  const declarations = new Map();
  program.emit(
    undefined,
    (file, text) => {
      const path = local(file)?.replace(/\.d\.ts$/, "");
      if (path === undefined) return;
      for (const source of [`${path}.ts`, `${path}.tsx`])
        if (read(source) !== undefined) declarations.set(source, text);
    },
    undefined,
    true,
  );
  return declarations;
}

/** Each reachable module's published entries, from one entry point. */
export function publishedSurface(entry, read, emitted = new Map()) {
  const parsed = new Map();
  const wanted = new Map([[entry, new Set(["*"])]]);
  const resolved = new Map();
  const surface = new Map();
  const queue = [entry];
  while (queue.length) {
    const path = queue.pop();
    const names = wanted.get(path);
    const key = [...names].sort().join("\0");
    if (resolved.get(path) === key) continue;
    resolved.set(path, key);
    if (!parsed.has(path)) {
      const source = read(path);
      parsed.set(
        path,
        source === undefined
          ? undefined
          : parseModule(path, source, emitted.get(path)),
      );
    }
    const module = parsed.get(path);
    if (!module) continue;
    const { entries, edges } = publishedEntries(module, names);
    surface.set(path, entries);
    for (const [specifier, name] of edges) {
      const target = resolveModule(path, specifier, read);
      if (!target) continue;
      const targetNames = wanted.get(target) ?? new Set();
      if (!targetNames.has(name)) {
        targetNames.add(name);
        wanted.set(target, targetNames);
        queue.push(target);
      }
    }
  }
  return surface;
}

/** Every local module `path` imports, directly or through other modules. */
function importClosure(path, read) {
  const seen = new Set([path]);
  const queue = [path];
  while (queue.length) {
    const current = queue.pop();
    const source = read(current);
    if (source === undefined) continue;
    const { importedFiles } = ts.preProcessFile(source, true, true);
    for (const { fileName } of importedFiles) {
      const target = resolveModule(current, fileName, read);
      if (target && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  seen.delete(path);
  return [...seen];
}

/** Changed files whose published declarations differ, reported by source. */
export function publicSurfaceChanges(files, read, options = {}) {
  const libraries = [
    ...new Set(publicEntryPoints.map((entry) => entry.replace(/src\/.*$/, ""))),
  ];
  // Every published module, synced mirrors included, lives in these libraries.
  if (!files.some((file) => libraries.some((root) => file.startsWith(root))))
    return [];
  const cache = new Map();
  const cached = (side, path) => {
    const key = `${side}:${path}`;
    if (!cache.has(key)) cache.set(key, read(side, path));
    return cache.get(key);
  };
  const changed = new Set(files);
  const flagged = new Set();
  // CI installs main's dependencies, so those must resolve. A package the PR
  // adds is not installed; its types read as `any` on the head side.
  const requireDependencies =
    options.requireDependencies &&
    new Set(
      libraries.flatMap((root) => {
        const manifest = JSON.parse(
          cached("base", `${root}package.json`) ?? "{}",
        );
        return ["dependencies", "devDependencies", "peerDependencies"].flatMap(
          (field) => Object.keys(manifest[field] ?? {}),
        );
      }),
    );
  const emitted = Object.fromEntries(
    ["base", "head"].map((side) => [
      side,
      emittedDeclarations((path) => cached(side, path), {
        ...options,
        requireDependencies,
      }),
    ]),
  );
  for (const entry of publicEntryPoints) {
    const [before, after] = ["base", "head"].map((side) =>
      publishedSurface(entry, (path) => cached(side, path), emitted[side]),
    );
    for (const path of new Set([...before.keys(), ...after.keys()])) {
      if (isDeepStrictEqual(before.get(path), after.get(path))) continue;
      // An unchanged module can publish a different inferred type because a
      // changed module it imports changed; that module is the edit.
      const causes = changed.has(path)
        ? [path]
        : ["base", "head"]
            .flatMap((side) =>
              importClosure(path, (file) => cached(side, file)),
            )
            .filter((file) => changed.has(file));
      for (const file of causes) flagged.add(syncedSource.get(file) ?? file);
    }
  }
  for (const root of libraries) {
    const manifest = `${root}package.json`;
    if (!changed.has(manifest)) continue;
    const fields = (side) => {
      const json = JSON.parse(cached(side, manifest) ?? "{}");
      return entryFields.map((field) => json[field]);
    };
    if (!isDeepStrictEqual(fields("base"), fields("head")))
      flagged.add(manifest);
  }
  return [...flagged];
}
