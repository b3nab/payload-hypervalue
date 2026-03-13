import type { HypervalueQueryArgs, HypervalueResult } from './types.js'

declare module 'payload' {
  export interface BasePayload {
    hypervalue(args: HypervalueQueryArgs): Promise<HypervalueResult>
  }
}
