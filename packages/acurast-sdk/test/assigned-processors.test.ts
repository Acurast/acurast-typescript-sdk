import { jobIdFromChainJson } from '../src/chain/assigned-processors.js'

describe('jobIdFromChainJson', () => {
  test('normalizes Acurast capital-A origin', () => {
    const j = jobIdFromChainJson([{ Acurast: '5ABC' }, 52540])
    expect(j).toEqual([{ acurast: '5ABC' }, 52540])
  })

  test('accepts lowercase acurast', () => {
    const j = jobIdFromChainJson([{ acurast: '5DEF' }, 1])
    expect(j).toEqual([{ acurast: '5DEF' }, 1])
  })

  test('throws on invalid payload', () => {
    expect(() => jobIdFromChainJson(null)).toThrow()
    expect(() => jobIdFromChainJson([])).toThrow()
  })
})
