import { historyMethod } from '../methods/history.js'
import { firstMethod } from '../methods/first.js'
import { lastMethod } from '../methods/last.js'
import { countMethod } from '../methods/count.js'
import { valueAtMethod } from '../methods/valueAt.js'

export const builtinMethods = {
  history: historyMethod,
  first: firstMethod,
  last: lastMethod,
  count: countMethod,
  valueAt: valueAtMethod,
}
