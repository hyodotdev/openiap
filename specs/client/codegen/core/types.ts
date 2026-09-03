/**
 * Intermediate Representation (IR) Types for GraphQL Code Generation
 *
 * These types represent a language-agnostic intermediate representation
 * of GraphQL schema types, which can be transformed into any target language.
 */

import type { CustomInputKind } from '../../custom-input-contracts.js';

// ============================================================================
// Type System
// ============================================================================

export type IRTypeKind = 'scalar' | 'enum' | 'object' | 'input' | 'interface' | 'union' | 'list';

export interface IRType {
  /** The kind of type */
  kind: IRTypeKind;
  /** The GraphQL type name (for named types) */
  name?: string;
  /** Whether this type is nullable */
  nullable: boolean;
  /** For list types, the element type */
  elementType?: IRType;
}

// ============================================================================
// Enums
// ============================================================================

export interface IREnumValue {
  /** Original GraphQL name (PascalCase) */
  name: string;
  /** Raw value for serialization (kebab-case) */
  rawValue: string;
  /** Description from GraphQL schema */
  description?: string;
  /** Legacy aliases for backwards compatibility */
  legacyAliases: string[];
}

export interface IREnum {
  /** Type name */
  name: string;
  /** Description from GraphQL schema */
  description?: string;
  /** Enum values */
  values: IREnumValue[];
  /** Whether this is the special ErrorCode enum that needs custom handling */
  isErrorCode: boolean;
}

// ============================================================================
// Fields
// ============================================================================

export interface IRField {
  /** Field name in GraphQL */
  name: string;
  /** Description from GraphQL schema */
  description?: string;
  /** Field type */
  type: IRType;
  /** Whether this field overrides an interface field */
  isOverride: boolean;
  /** Default value from SDL or generated discriminated union defaults. */
  defaultValue?: unknown;
}

// ============================================================================
// Interfaces
// ============================================================================

export interface IRInterface {
  /** Type name */
  name: string;
  /** Description from GraphQL schema */
  description?: string;
  /** Interface fields */
  fields: IRField[];
}

// ============================================================================
// Objects
// ============================================================================

export interface IRObject {
  /** Type name */
  name: string;
  /** Description from GraphQL schema */
  description?: string;
  /** Object fields */
  fields: IRField[];
  /** Interfaces this object implements */
  interfaces: string[];
  /** Unions this object belongs to */
  unions: string[];
  /** Whether this is a result union wrapper (has # => Union marker) */
  isResultUnion: boolean;
  /** For result unions, the variant entries */
  resultUnionEntries?: IRResultUnionEntry[];
}

export interface IRResultUnionEntry {
  /** Field name */
  fieldName: string;
  /** Variant documentation, including canonical deprecation guidance */
  description?: string;
  /** Field type */
  type: IRType;
}

// ============================================================================
// Inputs
// ============================================================================

export interface IRInput {
  /** Type name */
  name: string;
  /** Description from GraphQL schema */
  description?: string;
  /** Input fields */
  fields: IRField[];
  /** Whether this input has required (non-nullable) fields */
  hasRequiredFields: boolean;
  /** Whether this is a special type that needs custom handling */
  isCustomType: boolean;
  /** Custom type kind for special handling */
  customTypeKind?: CustomInputKind;
}

// ============================================================================
// Unions
// ============================================================================

export interface IRUnionMember {
  /** Member type name */
  name: string;
  /** Whether this member is itself a union (nested union) */
  isNestedUnion: boolean;
}

export interface IRUnion {
  /** Type name */
  name: string;
  /** Description from GraphQL schema */
  description?: string;
  /** Member types */
  members: IRUnionMember[];
  /** Shared interfaces across all members */
  sharedInterfaces: string[];
}

// ============================================================================
// Operations
// ============================================================================

export interface IRArg {
  /** Argument name */
  name: string;
  /** Description from GraphQL schema */
  description?: string;
  /** Argument type */
  type: IRType;
}

export interface IROperationField {
  /** Field name */
  name: string;
  /** Description from GraphQL schema */
  description?: string;
  /** Arguments */
  args: IRArg[];
  /** Return type */
  returnType: IRType;
  /** Resolved return type (after VoidResult -> Void, Args inlining) */
  resolvedReturnType: IRType;
}

export interface IROperation {
  /** Operation kind */
  kind: 'Query' | 'Mutation' | 'Subscription';
  /** Operation name */
  name: string;
  /** Description from GraphQL schema */
  description?: string;
  /** Operation fields */
  fields: IROperationField[];
}

// ============================================================================
// Schema (Root)
// ============================================================================

export interface IRSchema {
  /** All enum types */
  enums: IREnum[];
  /** All interface types */
  interfaces: IRInterface[];
  /** All object types */
  objects: IRObject[];
  /** All input types */
  inputs: IRInput[];
  /** All union types */
  unions: IRUnion[];
  /** Root operation types (Query, Mutation, Subscription) */
  operations: IROperation[];
}

// ============================================================================
// Schema Markers (from SDL comments)
// ============================================================================

export interface SchemaMarkers {
  /** Types marked with # => Union */
  unionWrappers: Set<string>;
  /** Fields marked with # Future */
  futureFields: Set<string>;
  /** Invalid or duplicate marker ownership detected by the shared parser */
  issues: SchemaMarkerIssue[];
}

interface SchemaMarkerIssue {
  kind: 'future' | 'union';
  reason: 'duplicate-marker' | 'invalid-placement' | 'invalid-owner' | 'invalid-target' | 'no-effect';
  sourceId: string;
  markerLine: number;
  targetLine: number | null;
  target?: string;
  previous?: {
    sourceId: string;
    markerLine: number;
  };
}

interface SchemaDeprecationEntry {
  kind: string;
  name: string;
  parentKind?: string;
  parentName?: string;
  ownerPath: string;
  reason: string;
  sourceId: string;
  line?: number;
}

interface SchemaDeprecationIssue {
  file: string;
  line?: number;
  message: string;
  rule: string;
}

export interface SchemaDeprecations {
  entries: SchemaDeprecationEntry[];
  issues: SchemaDeprecationIssue[];
  operationArguments: Array<{
    rootName: string;
    fieldName: string;
    argumentName: string;
    reason: string;
  }>;
  typeReasons: Map<string, string>;
}
