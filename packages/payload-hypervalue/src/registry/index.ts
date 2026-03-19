import { historyMethod } from '../methods/history.js'
import { firstMethod } from '../methods/first.js'
import { lastMethod } from '../methods/last.js'
import { countMethod } from '../methods/count.js'
import { valueAtMethod } from '../methods/valueAt.js'
import { aggregateMethod } from '../methods/aggregate.js'
import { statsMethod } from '../methods/stats.js'
import { percentileMethod } from '../methods/percentile.js'
import { deltaMethod } from '../methods/delta.js'
import { timeInStateMethod } from '../methods/timeInState.js'
import { gapfillMethod } from '../methods/gapfill.js'
import { topNMethod } from '../methods/topN.js'
import { candlestickMethod } from '../methods/candlestick.js'
import { nearbyMethod } from '../methods/nearby.js'
import { withinMethod } from '../methods/within.js'
import { trajectoryMethod } from '../methods/trajectory.js'

export const builtinMethods = {
  history: historyMethod,
  first: firstMethod,
  last: lastMethod,
  count: countMethod,
  valueAt: valueAtMethod,
  aggregate: aggregateMethod,
  stats: statsMethod,
  percentile: percentileMethod,
  delta: deltaMethod,
  timeInState: timeInStateMethod,
  gapfill: gapfillMethod,
  topN: topNMethod,
  candlestick: candlestickMethod,
  nearby: nearbyMethod,
  within: withinMethod,
  trajectory: trajectoryMethod,
}
