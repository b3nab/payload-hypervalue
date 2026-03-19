import type { CollectionSlug, PayloadRequest } from 'payload'

/**
 * Augmentable interface for hypervalue field map.
 *
 * When users run `payload generate:types`, the generated `payload-types.ts`
 * populates `Config['hypervalueFields']` with a mapping of collection slugs
 * to their tracked field names. This interface bridges the generated types
 * back into the plugin's own type system.
 *
 * Before codegen, it falls back to permissive `Record<string, string>`.
 */
export interface HypervalueFieldMap {}

/**
 * Resolves to only those CollectionSlug values that have hypervalue-tracked fields.
 * Falls back to the full CollectionSlug union when generated types are not available.
 */
export type HypervalueCollectionSlug = keyof HypervalueFieldMap extends never
  ? CollectionSlug
  : Extract<keyof HypervalueFieldMap, CollectionSlug>

/**
 * Resolves to the union of tracked field names for a given collection.
 * Falls back to `string` when generated types are not available.
 */
export type HypervalueFieldOf<T extends string> = T extends keyof HypervalueFieldMap
  ? HypervalueFieldMap[T] extends string
    ? HypervalueFieldMap[T]
    : string
  : string

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
