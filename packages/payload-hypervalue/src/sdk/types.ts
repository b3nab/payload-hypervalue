/**
 * Extension interface for user-defined hypervalue methods.
 * Empty by default — users augment it to register custom methods.
 *
 * @example
 * ```ts
 * declare module '@b3nab/payload-hypervalue/sdk' {
 *   interface HypervalueExtensions {
 *     movingAvg: typeof movingAvgMethod
 *   }
 * }
 * ```
 */
export interface HypervalueExtensions {}
