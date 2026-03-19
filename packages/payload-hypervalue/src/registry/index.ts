import { historyMethod } from '../methods/history.js'
import { firstMethod } from '../methods/first.js'
import { lastMethod } from '../methods/last.js'
import { countMethod } from '../methods/count.js'
import { valueAtMethod } from '../methods/valueAt.js'
import { aggregateMethod } from '../methods/aggregate.js'
import { statsMethod } from '../methods/stats.js'
import { percentileMethod } from '../methods/percentile.js'

export const builtinMethods = {
  history: historyMethod,
  first: firstMethod,
  last: lastMethod,
  count: countMethod,
  valueAt: valueAtMethod,
  aggregate: aggregateMethod,
  stats: statsMethod,
  percentile: percentileMethod,
}
