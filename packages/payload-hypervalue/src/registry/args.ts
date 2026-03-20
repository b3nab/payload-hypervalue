import type { CollectionSlug, GeneratedTypes, PayloadRequest } from 'payload'

/**
 * THIS FILE IS TYPES-ONLY. Do not add runtime code.
 *
 * Follows the same three-stage resolution pattern used by @payloadcms/plugin-ecommerce:
 * 1. After `generate:types`: GeneratedTypes has `hypervalueFields` → use precise types
 * 2. Before `generate:types`: GeneratedTypes has `hypervalueFieldsUntyped` → use fallback
 * 3. Neither exists: use permissive fallback
 *
 * The `hypervalueFieldsUntyped` augmentation below ensures the plugin always compiles.
 */

// Permissive fallback — accepts any collection slug and any field name
type HypervalueFieldsUntyped = Record<string, string>

// Three-stage resolution: prefer generated, then untyped fallback, then permissive
type ResolveHvFields<T> = T extends { hypervalueFields: infer M }
  ? M
  : T extends { hypervalueFieldsUntyped: infer M }
    ? M
    : HypervalueFieldsUntyped

type ResolvedHvFieldMap = ResolveHvFields<GeneratedTypes>

/**
 * Resolves to only those CollectionSlug values that have hypervalue-tracked fields.
 * Falls back to the full CollectionSlug union when generated types are not available.
 */
export type HypervalueCollectionSlug = string extends keyof ResolvedHvFieldMap
  ? CollectionSlug
  : Extract<keyof ResolvedHvFieldMap, string>

/**
 * Resolves to the union of tracked field names for a given collection.
 * Falls back to `string` when generated types are not available.
 */
export type HypervalueFieldOf<T extends string> = T extends keyof ResolvedHvFieldMap
  ? ResolvedHvFieldMap[T]
  : string

// Provide fallback augmentation so plugin works before types are generated.
// After codegen, `hypervalueFields` (non-optional, from typescript.schema) takes precedence.
declare module 'payload' {
  export interface GeneratedTypes {
    hypervalueFieldsUntyped: HypervalueFieldsUntyped
  }
}

// ---------------------------------------------------------------------------
// Composable arg building blocks
// ---------------------------------------------------------------------------

/** Core args present on every hypervalue method. */
export type BaseArgs<TSlug extends HypervalueCollectionSlug = HypervalueCollectionSlug> = {
  collection: TSlug
  /** Request object for access control */
  req?: PayloadRequest
  /** Bypass access control. Default: false */
  overrideAccess?: boolean
}

/** Required `field` arg — narrows to tracked fields when codegen is available. */
export type WithField<TSlug extends HypervalueCollectionSlug = HypervalueCollectionSlug> = {
  field: HypervalueFieldOf<TSlug>
}

/** Optional `field` arg — narrows to tracked fields when codegen is available. */
export type WithOptionalField<TSlug extends HypervalueCollectionSlug = HypervalueCollectionSlug> = {
  field?: HypervalueFieldOf<TSlug>
}

/** Required document ID. */
export type WithId = {
  id: string | number
}

/** Optional document ID. */
export type WithOptionalId = {
  id?: string | number
}

/** Optional time range (from/to). */
export type WithTimeRange = {
  /** Range query start */
  from?: Date
  /** Range query end */
  to?: Date
}

/** Required time range (from/to). */
export type WithRequiredTimeRange = {
  from: Date
  to: Date
}

/** Point-in-time query. */
export type WithAt = {
  at: Date
}

/** Pagination. */
export type WithPagination = {
  /** Pagination limit */
  limit?: number
  /** Pagination offset */
  offset?: number
}

/** Time-bucket interval. */
export type WithInterval = {
  interval: string
}

/** Optional time-bucket interval. */
export type WithOptionalInterval = {
  interval?: string
}
