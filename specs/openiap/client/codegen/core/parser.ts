/**
 * GraphQL Schema Parser
 *
 * Parses GraphQL schema files and extracts SDL markers (# => Union, # Future).
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildASTSchema, Kind, parse, type DocumentNode, type GraphQLSchema } from 'graphql';
import type { SchemaDeprecations, SchemaMarkers } from './types.js';
import { SCHEMA_FILE_NAMES } from '../../schema-files.mjs';
import { extractSchemaMarkers } from '../../schema-markers.mjs';
import { extractSchemaDeprecations } from '../../schema-deprecations.mjs';

// ============================================================================
// Configuration
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Default schema paths relative to the gql package */
const DEFAULT_SCHEMA_PATHS = SCHEMA_FILE_NAMES.map((fileName) => `../src/${fileName}`);

// ============================================================================
// Parser Interface
// ============================================================================

export interface ParsedSchema {
  /** The built GraphQL schema */
  schema: GraphQLSchema;
  /** Markers extracted from SDL comments */
  markers: SchemaMarkers;
  /** Canonical deprecation metadata extracted from SDL directives */
  deprecations: SchemaDeprecations;
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

    this.schemaPaths = (config.schemaPaths ?? DEFAULT_SCHEMA_PATHS).map((relativePath) => resolve(this.baseDir, relativePath));
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
      kind: Kind.DOCUMENT,
      definitions: this.schemaPaths.flatMap((schemaPath) => {
        const sdl = sdlContents.get(schemaPath)!;
        return parse(sdl).definitions;
      }),
    };

    // Validate directive locations and SDL ownership while building. OpenIAP's
    // nested-union codegen extension is validated separately by exact tests.
    const schema = buildASTSchema(documentNode);

    const sources = [...sdlContents].map(([sourceId, sdl]) => ({
      sourceId,
      sdl,
    }));
    const markers = extractSchemaMarkers(sources);
    const deprecations = extractSchemaDeprecations(sources);

    return { deprecations, markers, schema, sdlContents };
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
