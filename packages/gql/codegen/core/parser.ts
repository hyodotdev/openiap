/**
 * GraphQL Schema Parser
 *
 * Parses GraphQL schema files and extracts SDL markers (# => Union, # Future).
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildASTSchema,
  parse,
  type DocumentNode,
  type GraphQLSchema,
} from 'graphql';
import type { SchemaMarkers } from './types.js';

// ============================================================================
// Configuration
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Default schema paths relative to the gql package */
const DEFAULT_SCHEMA_PATHS = [
  '../src/schema.graphql',
  '../src/type.graphql',
  '../src/type-ios.graphql',
  '../src/type-android.graphql',
  '../src/api.graphql',
  '../src/api-ios.graphql',
  '../src/api-android.graphql',
  '../src/error.graphql',
  '../src/event.graphql',
];

// ============================================================================
// Parser Interface
// ============================================================================

export interface ParsedSchema {
  /** The built GraphQL schema */
  schema: GraphQLSchema;
  /** Markers extracted from SDL comments */
  markers: SchemaMarkers;
  /** Raw SDL content for each file */
  sdlContents: Map<string, string>;
}

export interface ParserConfig {
  /** Schema file paths (absolute or relative to scripts directory) */
  schemaPaths?: string[];
  /** Base directory for resolving relative paths */
  baseDir?: string;
}

// ============================================================================
// Schema Parser
// ============================================================================

export class SchemaParser {
  private schemaPaths: string[];
  private baseDir: string;

  constructor(config: ParserConfig = {}) {
    // Default base directory is the gql/scripts folder
    this.baseDir = config.baseDir ?? resolve(__dirname, '../../scripts');

    this.schemaPaths = (config.schemaPaths ?? DEFAULT_SCHEMA_PATHS).map(
      (relativePath) => resolve(this.baseDir, relativePath)
    );
  }

  /**
   * Parse all schema files and build a unified schema
   */
  parse(): ParsedSchema {
    const sdlContents = new Map<string, string>();

    // Load all SDL files
    for (const schemaPath of this.schemaPaths) {
      const content = readFileSync(schemaPath, 'utf8');
      sdlContents.set(schemaPath, content);
    }

    // Build combined document
    const documentNode: DocumentNode = {
      kind: 'Document',
      definitions: this.schemaPaths.flatMap((schemaPath) => {
        const sdl = sdlContents.get(schemaPath)!;
        return parse(sdl).definitions;
      }),
    };

    // Build schema
    const schema = buildASTSchema(documentNode, { assumeValidSDL: true });

    // Extract markers from SDL comments
    const markers = this.extractMarkers(sdlContents);

    return { schema, markers, sdlContents };
  }

  /**
   * Extract markers from SDL comments
   *
   * Supported markers:
   * - `# => Union` - Marks the following type as a union wrapper
   * - `# Future` - Marks the following field as async (wrap in Promise)
   */
  private extractMarkers(sdlContents: Map<string, string>): SchemaMarkers {
    const unionWrappers = new Set<string>();
    const futureFields = new Set<string>();

    for (const sdl of sdlContents.values()) {
      const lines = sdl.split(/\r?\n/);
      let expectUnionType = false;
      let expectFutureField = false;
      let currentTypeName: string | null = null;

      for (const line of lines) {
        const trimmed = line.trim();

        // Track current type context
        const typeMatch = trimmed.match(/^type\s+([A-Za-z0-9_]+)/);
        if (typeMatch) {
          currentTypeName = typeMatch[1];
          if (expectUnionType) {
            unionWrappers.add(currentTypeName);
            expectUnionType = false;
          }
          continue;
        }

        // Check for # => Union marker
        if (trimmed.startsWith('#') && trimmed.toLowerCase().includes('=> union')) {
          expectUnionType = true;
          continue;
        }

        // Check for # Future marker (strict matching to avoid false positives)
        if (/^#\s*future\b/i.test(trimmed)) {
          expectFutureField = true;
          continue;
        }

        // Handle field after # Future marker
        if (expectFutureField && currentTypeName) {
          const fieldMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*[:(]/);
          if (fieldMatch) {
            futureFields.add(`${currentTypeName}.${fieldMatch[1]}`);
            expectFutureField = false;
          }
          // Skip empty lines and comments while waiting for field
          if (trimmed.length === 0 || trimmed.startsWith('#')) {
            continue;
          }
          // Reset if we hit something unexpected
          expectFutureField = false;
        }

        // Reset union expectation if we hit non-empty, non-comment, non-type line
        if (expectUnionType && trimmed.length > 0 && !trimmed.startsWith('#')) {
          expectUnionType = false;
        }
      }
    }

    return { unionWrappers, futureFields };
  }

  /**
   * Get the schema file paths
   */
  getSchemaPaths(): string[] {
    return [...this.schemaPaths];
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

/**
 * Parse the default schema configuration
 */
export function parseSchema(config?: ParserConfig): ParsedSchema {
  const parser = new SchemaParser(config);
  return parser.parse();
}
