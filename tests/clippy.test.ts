import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

// What a session answers beneath the plugin: a store the test can read back,
// a start, a command list, a speaker, a toast, and an engine that draws
// nothing of its own above the prompt.
function host(on: On, stored: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(stored))
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', ($, e) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('session.start', () => ({ cwd: '/tmp' }))
  on('command.register', () => ({ value: { command: 'clippy' } }))
  on('audio.play', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return h(Box, {})
  })
  return store
}

const OPTIONS = { options: { ai: false, leaderboard: 'off' } } as const

const BAND = {
  plugin: 'inappropriate-clippy',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 12, bodyColumns: 100, scroll: { offset: 0, bodyRows: 12 }, view: {} },
} as const

test('he greets you, draws on every surface, and keeps his buttons', OPTIONS, async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  const store = host(on)
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ key: 'slap' })).toBeDefined()
    expect(await ui.find({ key: 'kill' })).toBeDefined()
    expect(await ui.find({ key: 'hide' })).toBeDefined()
    expect((await ui.findAll({ type: 'Svg' })).length).toBe(surface === 'desktop' ? 1 : 0)
    await ui.unmount()
  }
})

test('rm -rf gets a line and the call goes through untouched', OPTIONS, async ($, on) => {
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  const store = host(on)
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } }) as never)
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await clock.advance(20_000) // past the quiet spell after his greeting

  const ran = await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  expect(ran.deny).toBeUndefined()

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /-rf/ })).toBeDefined()
  await ui.unmount()
})

test('a slap is counted and remembered across sessions', OPTIONS, async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  const store = host(on, { slaps: 41 })
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'slap' })
  expect(store.get('slaps')).toBe(42)
  await ui.unmount()
})

test('kill puts up a stone, and he comes back', OPTIONS, async ($, on) => {
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  const store = host(on)
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })

  let ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'kill' })
  await ui.unmount()
  expect(store.get('kills')).toBe(1)

  await clock.advance(5_000)
  ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ key: 'poke' })).toBeDefined()
  expect(await ui.find({ key: 'slap' })).toBeUndefined()
  await ui.unmount()

  await clock.advance(5 * 60_000)
  ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ key: 'slap' })).toBeDefined()
  await ui.unmount()
})

test('hide clears the band and /clippy brings him back', OPTIONS, async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  const store = host(on)
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })

  let ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'hide' })
  await ui.unmount()
  ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ key: 'slap' })).toBeUndefined()
  await ui.unmount()

  const ran = await $.command.run({ command: 'clippy', args: '' })
  expect(ran).toEqual(expect.objectContaining({ text: 'Clippy is back.' }))
  ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ key: 'slap' })).toBeDefined()
  await ui.unmount()
})

test('/clippy revive brings him back early, once', OPTIONS, async ($, on) => {
  const clock = mock.clock(on, { now: 1_800_000_000_000 })
  const store = host(on)
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })

  let ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'kill' })
  await ui.unmount()
  await clock.advance(5_000)
  expect(store.has('grave')).toBe(true)

  expect(await $.command.run({ command: 'clippy', args: 'revive' })).toEqual(
    expect.objectContaining({ text: 'Clippy is back from the dead.' }),
  )
  expect(store.has('grave')).toBe(false)
  ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ key: 'slap' })).toBeDefined()
  await ui.unmount()

  expect(await $.command.run({ command: 'clippy', args: 'revive' })).toEqual(expect.objectContaining({ text: "Clippy isn't dead." }))
})
