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
import type { CodegenPlugin } from './plugins/base-plugin.js';
import type { IRSchema } from './core/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

export interface GenerateConfig {
  /** Languages to generate (default: all) */
  languages?: Array<'swift' | 'kotlin' | 'dart' | 'gdscript'>;
  /** Output directory (default: packages/gql/src/generated) */
  outputDir?: string;
  /** Whether to log progress */
  verbose?: boolean;
}

// ============================================================================
// Main Generator
// ============================================================================

export class CodeGenerator {
  private config: GenerateConfig;
  private schema: IRSchema | null = null;

  constructor(config: GenerateConfig = {}) {
    this.config = {
      languages: config.languages ?? ['swift', 'kotlin'],
      outputDir: config.outputDir ?? resolve(__dirname, '../src/generated'),
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
    this.schema = transformSchema(parsedSchema);
    this.log(`Found ${this.schema.enums.length} enums, ${this.schema.objects.length} objects, ${this.schema.unions.length} unions`);

    // Generate for each language
    for (const language of this.config.languages!) {
      await this.generateForLanguage(language);
    }

    this.log('Code generation complete!');
  }

  /**
   * Generate code for a specific language
   */
  private async generateForLanguage(language: string): Promise<void> {
    const plugin = this.createPlugin(language);
    if (!plugin) {
      this.log(`Skipping ${language} - plugin not implemented`);
      return;
    }

    this.log(`Generating ${language}...`);
    const output = plugin.generate(this.schema!);

    const outputPath = plugin.getOutputPath();
    const fullPath = resolve(this.config.outputDir!, outputPath);

    // Ensure directory exists
    mkdirSync(dirname(fullPath), { recursive: true });

    // Write file
    writeFileSync(fullPath, output);
    this.log(`  Wrote ${fullPath}`);
  }

  /**
   * Create a plugin for the given language
   */
  private createPlugin(language: string): CodegenPlugin | null {
    switch (language) {
      case 'swift':
        return new SwiftPlugin({
          outputPath: 'Types.swift',
        });
      case 'kotlin':
        return new KotlinPlugin({
          outputPath: 'Types.kt',
        });
      case 'dart':
        return new DartPlugin({
          outputPath: 'types.dart',
        });
      case 'gdscript':
        return new GDScriptPlugin({
          outputPath: 'types.gd',
        });
      default:
        return null;
    }
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
  const languages = args.length > 0
    ? args as Array<'swift' | 'kotlin' | 'dart' | 'gdscript'>
    : ['swift', 'kotlin', 'dart', 'gdscript'];

  const generator = new CodeGenerator({ languages });
  await generator.generate();
}

// Run if executed directly (Bun-compatible check)
const isMain =
  typeof Bun !== 'undefined'
    ? Bun.main === import.meta.path
    : import.meta.url === `file://${process.argv[1]}`;

if (isMain) {
  main().catch((err) => {
    console.error('Code generation failed:', err);
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
export type { IRSchema, IREnum, IRObject, IRUnion, IRType } from './core/types.js';
