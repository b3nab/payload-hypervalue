import { describe, it, expect, expectTypeOf } from 'vitest'
import { defineMethod } from '../registry/define.js'
import type { HypervalueDescriptor, InferNamespace, MethodDefinition } from '../registry/types.js'

describe('registry types', () => {
  it('defineMethod preserves arg and result types', () => {
    type TestArgs = { collection: string; field: string }
    type TestResult = { docs: { value: number }[] }

    const method = defineMethod({
      build: (_discovery, args: TestArgs): HypervalueDescriptor<TestResult> => ({
        sqlFragment: {} as any,
        parse: () => ({ docs: [] }),
        validate: () => {},
        accessCheck: { collection: args.collection },
      }),
    })

    expect(method).toBeDefined()
    expect(typeof method.build).toBe('function')
    expectTypeOf(method).toMatchTypeOf<MethodDefinition<TestArgs, TestResult>>()
  })

  it('InferNamespace derives correct method signatures', () => {
    type ArgsA = { collection: string }
    type ResultA = { doc: { value: number } | null }
    type ArgsB = { collection: string; field: string }
    type ResultB = { totalDocs: number }

    const methods = {
      methodA: defineMethod({
        build: (_d, _args: ArgsA): HypervalueDescriptor<ResultA> => ({
          sqlFragment: {} as any,
          parse: () => ({ doc: null }),
          validate: () => {},
          accessCheck: { collection: _args.collection },
        }),
      }),
      methodB: defineMethod({
        build: (_d, _args: ArgsB): HypervalueDescriptor<ResultB> => ({
          sqlFragment: {} as any,
          parse: () => ({ totalDocs: 0 }),
          validate: () => {},
          accessCheck: { collection: _args.collection },
        }),
      }),
    }

    type Namespace = InferNamespace<typeof methods>
    expectTypeOf<Namespace['methodA']>().toEqualTypeOf<(args: ArgsA) => Promise<ResultA>>()
    expectTypeOf<Namespace['methodB']>().toEqualTypeOf<(args: ArgsB) => Promise<ResultB>>()
  })
})
