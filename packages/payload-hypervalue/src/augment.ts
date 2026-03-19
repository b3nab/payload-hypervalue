import type {
  BaseArgs,
  HypervalueCollectionSlug,
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
} from './registry/args.js'
import type { AggregateMetric } from './methods/aggregate.js'
import type { GapfillMethod } from './methods/gapfill.js'
import type { HypervalueResult, HypervalueRecord, HypervalueSnapshotRecord } from './types.js'
import type { BatchFunction } from './batch/types.js'

// ---------------------------------------------------------------------------
// Method result types (keep in sync with each method file)
// ---------------------------------------------------------------------------

type HistoryResult = HypervalueResult

type FirstResult = { doc: HypervalueRecord | null }
type LastResult = { doc: HypervalueRecord | null }

type CountResult = { totalDocs: number }

type ValueAtResult = { doc: HypervalueRecord | HypervalueSnapshotRecord | null }

type BucketedAggResult = { docs: { bucket: string; value: number }[] }
type SingleAggResult = { doc: { value: number } }
type AggregateResult = BucketedAggResult | SingleAggResult

type StatsResult = {
  doc: {
    mean: number | null
    stddev: number | null
    variance: number | null
    min: number | null
    max: number | null
    count: number
  }
}

type PercentileResult = { doc: Record<string, number> }

type PerRecordDelta = { delta: number; rate: number | null; recorded_at: string }
type BucketedDelta = { bucket: string; delta: number }
type DeltaResult = { docs: PerRecordDelta[] } | { docs: BucketedDelta[] }

type TimeInStateRow = { state: unknown; duration: number; unit: 'seconds' }
type TimeInStateResult = { docs: TimeInStateRow[] }

type GapfillRow = { bucket: string; value: number | null }
type GapfillResult = { docs: GapfillRow[] }

type TopNResult = { docs: HypervalueRecord[] }

type CandlestickRecord = {
  bucket: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}
type CandlestickResult = { docs: CandlestickRecord[] }

type NearbyRecord = {
  documentId: string | number
  value: [number, number]
  recorded_at: string
  distance: number
}
type NearbyResult = { docs: NearbyRecord[] }

type WithinRecord = {
  documentId: string | number
  value: [number, number]
  recorded_at: string
}
type WithinResult = { docs: WithinRecord[] }

type TrajectoryPoint = { coordinates: [number, number]; recorded_at: string }
type TrajectoryResult = {
  doc: {
    lineString: object | null
    points: TrajectoryPoint[]
  }
}

// ---------------------------------------------------------------------------
// Namespace declaration with generic method signatures for autocomplete
// ---------------------------------------------------------------------------

declare module 'payload' {
  export interface BasePayload {
    hypervalue: {
      history<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithId & WithOptionalField<T> & WithTimeRange & WithPagination & { at?: Date },
      ): Promise<HistoryResult>

      first<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithField<T> & WithOptionalId & WithTimeRange,
      ): Promise<FirstResult>

      last<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithField<T> & WithOptionalId & WithTimeRange,
      ): Promise<LastResult>

      count<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithOptionalField<T> & WithOptionalId & WithTimeRange,
      ): Promise<CountResult>

      valueAt<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithOptionalField<T> & WithId & WithAt,
      ): Promise<ValueAtResult>

      aggregate<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithField<T> & WithOptionalId & WithOptionalInterval & WithTimeRange & {
          metric: AggregateMetric
        },
      ): Promise<AggregateResult>

      stats<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithField<T> & WithOptionalId & WithTimeRange,
      ): Promise<StatsResult>

      percentile<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithField<T> & WithOptionalId & WithTimeRange & {
          percentiles: number[]
        },
      ): Promise<PercentileResult>

      delta<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithField<T> & WithOptionalId & WithOptionalInterval & WithTimeRange,
      ): Promise<DeltaResult>

      timeInState<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithField<T> & WithOptionalId & WithTimeRange,
      ): Promise<TimeInStateResult>

      gapfill<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithField<T> & WithOptionalId & WithInterval & WithRequiredTimeRange & {
          method?: GapfillMethod
        },
      ): Promise<GapfillResult>

      topN<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithField<T> & WithOptionalId & WithTimeRange & {
          n: number
          direction: 'asc' | 'desc'
        },
      ): Promise<TopNResult>

      candlestick<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithField<T> & WithOptionalId & WithInterval & WithTimeRange,
      ): Promise<CandlestickResult>

      nearby<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithOptionalField<T> & WithTimeRange & WithPagination & {
          point: [number, number]
          maxDistance?: number
          minDistance?: number
        },
      ): Promise<NearbyResult>

      within<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithOptionalField<T> & WithTimeRange & WithPagination & {
          geometry: object
        },
      ): Promise<WithinResult>

      trajectory<T extends HypervalueCollectionSlug>(
        args: BaseArgs<T> & WithOptionalField<T> & WithId & WithTimeRange & WithPagination,
      ): Promise<TrajectoryResult>

      batch: BatchFunction
    }
  }
}
