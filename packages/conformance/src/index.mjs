export {
  BEHAVIORS,
  BEHAVIOR_CATEGORIES,
  BEHAVIOR_LEVELS,
  behaviorById,
  behaviorIds,
  behaviorsByCategory,
} from './spec/behaviors.mjs';
export { SUITE_VERSION, specVersion } from './spec/version.mjs';
export { runConformance, NOT_IMPLEMENTED } from './runner/runner.mjs';
export { runDifferential, formatDifferentialReport } from './runner/differential.mjs';
export {
  METAMORPHIC_RELATIONS,
  assertRelationIntegrity,
  unverifiedRelations,
} from './spec/metamorphic-relations.mjs';
export { formatReport, toJsonReport } from './runner/report.mjs';
export { FakeStore, StoreOutcome } from './fake-store/fake-store.mjs';
export { ReferenceImplementation, ConformanceError } from './fake-store/reference-implementation.mjs';
export { createReferenceAdapter } from './adapters/reference-adapter.mjs';
