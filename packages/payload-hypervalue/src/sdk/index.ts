// Core builder
export { defineMethod } from '../registry/define.js'

// Types for building custom methods
export type {
  HypervalueDescriptor,
  MethodDefinition,
  EndpointConfig,
  InferNamespace,
} from '../registry/types.js'

// Extension interface
export type { HypervalueExtensions } from './types.js'

// Composable arg types for building method signatures
export type {
  HypervalueCollectionSlug,
  HypervalueFieldOf,
  BaseArgs,
  WithField,
  WithOptionalField,
  WithId,
  WithOptionalId,
  WithTimeRange,
  WithRequiredTimeRange,
  WithAt,
  WithPagination,
  WithInterval,
  WithOptionalInterval,
} from '../registry/args.js'
