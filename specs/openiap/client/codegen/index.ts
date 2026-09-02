/**
 * OpenIAP GraphQL Code Generation
 *
 * Unified entry point for generating typed code from GraphQL schema.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSchema } from './core/parser.js';
import { transformSchema } from './core/transformer.js';
import { SwiftPlugin } from './plugins/swift.js';
import { KotlinPlugin } from './plugins/kotlin.js';
import { DartPlugin } from './plugins/dart.js';
import { GDScriptPlugin } from './plugins/gdscript.js';
import { CSharpPlugin } from './plugins/csharp.js';
import type { CodegenPlugin } from './plugins/base-plugin.js';
import type { IRSchema } from './core/types.js';
import { lintSchema, formatLintResults } from './core/schema-linter.js';
import { GQL_GENERATED_SOURCE_DIRECTORY, generatedSourceFileName, gqlPackageRelativePath } from '../generated-sync-manifest.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const LANGUAGE_PLUGIN_FACTORIES = {
  swift: (outputPath: string) => new SwiftPlugin({ outputPath }),
  kotlin: (outputPath: string) => new KotlinPlugin({ outputPath }),
  dart: (outputPath: string) => new DartPlugin({ outputPath }),
  gdscript: (outputPath: string) => new GDScriptPlugin({ outputPath }),
  csharp: (outputPath: string) => new CSharpPlugin({ outputPath }),
} as const satisfies Record<string, (outputPath: string) => CodegenPlugin>;

export type SupportedLanguage = keyof typeof LANGUAGE_PLUGIN_FACTORIES;
export const SUPPORTED_LANGUAGES = Object.freeze(Object.keys(LANGUAGE_PLUGIN_FACTORIES) as SupportedLanguage[]);
export const LANGUAGE_OUTPUT_PATHS = Object.freeze(
  Object.fromEntries(SUPPORTED_LANGUAGES.map((language) => [language, generatedSourceFileName(language)])) as Record<
    SupportedLanguage,
    string
  >,
);

export function normalizeLanguages(languages: readonly string[] | undefined = undefined): SupportedLanguage[] {
  const requested = languages ?? SUPPORTED_LANGUAGES;
  if (requested.length === 0) {
    throw new Error('At least one codegen language is required');
  }

  const normalized: SupportedLanguage[] = [];
  for (const language of requested) {
    if (!SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
      throw new Error(`Unsupported codegen language: ${language}`);
    }
    if (!normalized.includes(language as SupportedLanguage)) {
      normalized.push(language as SupportedLanguage);
    }
  }
  return normalized;
}

export interface GenerateConfig {
  /** Languages to generate (default: all) */
  languages?: SupportedLanguage[];
  /** Output directory (default: specs/openiap/client/src/generated) */
  outputDir?: string;
  /** Whether to log progress */
  verbose?: boolean;
}

// ============================================================================
// Main Generator
// ============================================================================

export class CodeGenerator {
  private config: Required<GenerateConfig>;
  private schema: IRSchema | null = null;

  constructor(config: GenerateConfig = {}) {
    this.config = {
      languages: normalizeLanguages(config.languages),
      outputDir: config.outputDir ?? resolve(__dirname, '..', gqlPackageRelativePath(GQL_GENERATED_SOURCE_DIRECTORY)),
      verbose: config.verbose ?? true,
    };
  }

  /**
   * Generate code for all configured languages
   */
  async generate(): Promise<void> {
    // Parse and transform schema
    this.log('Parsing GraphQL schema...');
    const parsedSchema = parseSchema();

    // Lint schema conventions
    this.log('Linting schema conventions...');
    const lintResults = lintSchema(parsedSchema);
    const lintOutput = formatLintResults(lintResults);
    this.log(lintOutput);

    const lintErrors = lintResults.filter((r) => r.level === 'error');
    if (lintErrors.length > 0) {
      throw new Error(`Schema lint failed with ${lintErrors.length} error(s). Fix the above issues before generating code.`);
    }

    this.schema = transformSchema(parsedSchema);
    this.log(`Found ${this.schema.enums.length} enums, ${this.schema.objects.length} objects, ${this.schema.unions.length} unions`);

    // Generate for each language
    for (const language of this.config.languages) {
      await this.generateForLanguage(language);
    }

    this.log('Code generation complete!');
  }

  /**
   * Generate code for a specific language
   */
  private async generateForLanguage(language: SupportedLanguage): Promise<void> {
    const plugin = this.createPlugin(language);

    this.log(`Generating ${language}...`);
    const output = plugin.generate(this.schema!);

    const outputPath = plugin.getOutputPath();
    const fullPath = resolve(this.config.outputDir, outputPath);

    // Ensure directory exists
    mkdirSync(dirname(fullPath), { recursive: true });

    // Write file
    writeFileSync(fullPath, output);
    this.log(`  Wrote ${fullPath}`);
  }

  /**
   * Create a plugin for the given language
   */
  private createPlugin(language: SupportedLanguage): CodegenPlugin {
    return LANGUAGE_PLUGIN_FACTORIES[language](LANGUAGE_OUTPUT_PATHS[language]);
  }

  /**
   * Log a message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.config.verbose) {
      // eslint-disable-next-line no-console
      console.log(`[codegen] ${message}`);
    }
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const generator = new CodeGenerator({
    languages: args.length > 0 ? normalizeLanguages(args) : undefined,
  });
  await generator.generate();
}

// Run if executed directly (Bun-compatible check)
const isMain = typeof Bun !== 'undefined' ? Bun.main === import.meta.path : import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  main().catch((err) => {
    console.error('\n❌ Code generation failed:');
    if (err instanceof Error) {
      console.error(`  ${err.message}`);
      if (err.stack) {
        console.error('\nStack trace:');
        console.error(err.stack);
      }
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}

// ============================================================================
// Exports
// ============================================================================

export { parseSchema } from './core/parser.js';
export { transformSchema } from './core/transformer.js';
export { SwiftPlugin } from './plugins/swift.js';
export { KotlinPlugin } from './plugins/kotlin.js';
export { DartPlugin } from './plugins/dart.js';
export { GDScriptPlugin } from './plugins/gdscript.js';
export { CSharpPlugin } from './plugins/csharp.js';
export type { IRSchema, IREnum, IRObject, IRUnion, IRType } from './core/types.js';
export { lintSchema, formatLintResults } from './core/schema-linter.js';
export type { LintResult } from './core/schema-linter.js';
