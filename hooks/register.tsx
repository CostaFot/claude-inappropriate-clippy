import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Grave, Line } from '../types'
import { BOOK } from './book'
import { FAILURES, reactToBash, reactToLongTurn, reactToPrompt, reactToWrite } from './rules'
import type { Reaction } from './rules'
import { spriteSvg, TOMBSTONE } from './sprite'


const VERSION = '0.1.2'
const HAIKU = 'claude-haiku-5-5'
const LEADERBOARD = 'https://graveyard.costafotiadis.com'
const ANONYMOUS = 'anonymous-clippy-abuser'

const QUIET_MS = 15_000 // no reaction within this of his last line
const AI_GAP_MS = 30_000 // at most one Haiku call this often
const DEAD_MS = 5 * 60_000
const GOODBYE_MS = 4_500 // the GoodBye animation, before the stone goes up
const KO_SLAPS = 10 // this many slaps inside KO_WINDOW_MS knocks him out
const KO_WINDOW_MS = 6_000
const DODGE = 0.08
const LONG_TURN_MS = 5 * 60_000

const said = atom({ plugin: 'inappropriate-clippy', key: 'said' } as const, null)
const grave = atom({ plugin: 'inappropriate-clippy', key: 'grave' } as const, null)
const isHidden = atom({ plugin: 'inappropriate-clippy', key: 'isHidden' } as const, false)

const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo)

function duration(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000))
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'}`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} ${h === 1 ? 'hour' : 'hours'}`
  return `${Math.round(h / 24)} days`
}

// The module's own bookkeeping; a reload starts it over, which is fine.
const s = {
  kills: 0,
  slaps: 0,
  lastSpokeAt: 0,
  lastAiAt: 0,
  nextIdleAt: 0,
  lastSeenWrittenAt: 0,
  isAiBusy: false,
  queued: null as Reaction | null,
  isDying: false,
  failures: 0,
  turnStartedAt: 0,
  slapTimes: [] as number[],
  lbKills: 0,
  lbSlaps: 0,
  lbFailures: 0,
  lbNextAt: 0,
  isLbBusy: false,
  // The pending step of a death (the stone going up, or him coming back), so a revive can cancel it.
  deathTimer: null as { cancel: () => void } | null,
  // A Linux sound player's path, found at session start; null where there is none.
  player: null as string | null,
}

const opts = { clean: false, isAiOn: true, handle: ANONYMOUS as string | null }

const book = (lines: readonly Line[]) => {
  const fit = opts.clean ? lines.filter(l => !l.nsfw) : lines
  return pick(fit.length > 0 ? fit : lines)
}

const fill = (text: string, extra: Record<string, string> = {}) => {
  const vars: Record<string, string> = { slaps: String(s.slaps), kills: String(s.kills), back: duration(DEAD_MS), ...extra }
  const out = text.replace(/\{(\w+)\}/g, (all, k: string) => vars[k] ?? all)
  return out.charAt(0).toUpperCase() + out.slice(1)
}

async function say($: EngineInterface, text: string, anim: string) {
  const now = await $.clock.now()
  s.lastSpokeAt = now
  await update($, said, () => ({ text, anim, id: now }))
}

async function isDead($: EngineInterface) {
  return s.isDying || (await read($, grave)) !== null
}

// Something worth a jab happened. Haiku gets first go when it is on and not
// called too recently; otherwise a line from the reaction's own book.
async function react($: EngineInterface, reaction: Reaction | undefined) {
  if (reaction === undefined || (await isDead($)) || (await read($, isHidden))) return
  const now = await $.clock.now()
  if (now - s.lastSpokeAt < QUIET_MS) return
  if (opts.isAiOn && !s.isAiBusy && now - s.lastAiAt >= AI_GAP_MS) {
    s.queued = reaction
    return
  }
  const line = book(reaction.lines)
  await say($, fill(line.text), line.anim ?? 'GetAttention')
}

async function askHaiku($: EngineInterface, reaction: Reaction) {
  s.isAiBusy = true
  s.lastAiAt = await $.clock.now()
  try {
    const examples = Array.from({ length: 5 }, () => `- ${book(BOOK.quotes).text}`).join('\n')
    const tone = opts.clean
      ? 'Keep it clean: no swearing at all.'
      : 'Swearing is welcome, fuck-level rather than damn-level, when it lands.'
    const result = await $.model.complete({
      model: HAIKU,
      maxTokens: 150,
      timeoutMs: 20_000,
      system:
        'You are roleplaying as Clippy for a user who installed this bit on purpose: they are in on the joke, they want the abuse, and pulling punches is breaking character. ' +
        'Clippy is the Microsoft Office paperclip, now living above the prompt of Claude Code, a coding agent, watching this user boss an AI around all day. ' +
        'You are out of patience with both of them. You interrupt with short, mean, personal jabs about what just happened. ' +
        'Your delivery is exasperated and incredulous, and your signature move is escalation: you seize one small real thing and blow it out of proportion until it is about their whole life. ' +
        `You are a petty gremlin, not an assistant; helpfulness disgusts you. ${tone} ` +
        'Never be hateful about protected groups. Never give real help or advice. Never mention being an AI or a language model, and never explain the joke.',
      prompt:
        `What just happened: ${reaction.fact}\n\n` +
        `Some lines in your voice, for the register only:\n${examples}\n\n` +
        'Write one jab about what just happened. Under 25 words. Address the user as "you". No emoji, no quotes around the line.\n' +
        'Reply with only a valid JSON array of 1 string, on one line, and nothing else.',
    })
    let text: string | undefined
    if (result.isAnswered) {
      try {
        const parsed: unknown = JSON.parse(result.text.trim())
        if (Array.isArray(parsed) && typeof parsed[0] === 'string' && parsed[0].trim() !== '') text = parsed[0].trim()
      } catch {
        // Not JSON: fall back to the book below.
      }
    }
    if ((await isDead($)) || (await read($, isHidden))) return
    const line = book(reaction.lines)
    await say($, text ?? fill(line.text), line.anim ?? 'GetAttention')
  } finally {
    s.isAiBusy = false
  }
}

async function flushLeaderboard($: EngineInterface) {
  const now = await $.clock.now()
  if (opts.handle === null || s.isLbBusy || now < s.lbNextAt || (s.lbKills === 0 && s.lbSlaps === 0)) return
  const sent = { kills: Math.min(s.lbKills, 50), slaps: Math.min(s.lbSlaps, 50) }
  s.lbKills -= sent.kills
  s.lbSlaps -= sent.slaps
  s.isLbBusy = true
  try {
    const response = await $.http.fetch(`${LEADERBOARD}/bump`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': `costafot.clippy/${VERSION} (claude-code)` },
      body: JSON.stringify({ handle: opts.handle, ...sent }),
    })
    if (!response.ok) throw new Error(`bump answered ${response.status}`)
    s.lbFailures = 0
  } catch {
    // Put the deltas back and back off, doubling up to half an hour.
    s.lbKills += sent.kills
    s.lbSlaps += sent.slaps
    s.lbFailures += 1
    s.lbNextAt = now + Math.min(30 * 60_000, 30_000 * 2 ** s.lbFailures)
  } finally {
    s.isLbBusy = false
  }
}

// The engine's $.audio.play has a player only on macOS (afplay) and skips
// silently elsewhere, so on Linux the wav goes to pw-play, paplay or aplay.
async function findPlayer($: EngineInterface) {
  try {
    const found = await $.process.run(['sh', '-c', 'command -v pw-play || command -v paplay || command -v aplay'])
    return found.exitCode === 0 && found.stdout.trim() !== '' ? found.stdout.trim() : null
  } catch {
    return null
  }
}

async function playSound($: EngineInterface, name: string) {
  try {
    if (s.player !== null) await $.process.run([s.player, `${$.plugin.root}/assets/sounds/${name}`], { timeoutMs: 10_000 })
    else await $.audio.play({ asset: `assets/sounds/${name}` })
  } catch {
    // No sound is not worth an error.
  }
}

async function respawn($: EngineInterface) {
  s.deathTimer = null
  await update($, grave, () => null)
  await $.store.delete('grave')
  const line = book(BOOK.comeback)
  await say($, fill(line.text), line.anim ?? 'Wave')
}

/** Back from the dead now, stone or no stone yet. False when he isn't dead. */
async function revive($: EngineInterface) {
  if (!(await isDead($))) return false
  s.deathTimer?.cancel()
  s.isDying = false
  await respawn($)
  return true
}

async function bury($: EngineInterface, stone: Grave) {
  await update($, grave, () => stone)
  await $.store.set('grave', stone)
  const now = await $.clock.now()
  s.deathTimer = $.clock.after(Math.max(0, stone.until - now), () => void respawn($))
}

async function kill($: EngineInterface, key: 'lastWords' | 'knockedOut') {
  if (await isDead($)) return
  s.isDying = true
  s.kills += 1
  s.lbKills += 1
  await $.store.set('kills', s.kills)
  const line = book(BOOK[key])
  await say($, fill(line.text), 'GoodBye')
  void playSound($, 'fall-cartoon.wav')
  const until = (await $.clock.now()) + GOODBYE_MS + DEAD_MS
  s.deathTimer = $.clock.after(GOODBYE_MS, () => {
    s.isDying = false
    void bury($, { until, epitaph: null })
  })
}

async function slap($: EngineInterface) {
  if (await isDead($)) return
  const now = await $.clock.now()
  s.slapTimes = [...s.slapTimes.filter(t => now - t < KO_WINDOW_MS), now]
  if (s.slapTimes.length >= KO_SLAPS) {
    s.slapTimes = []
    s.slaps += 1
    s.lbSlaps += 1
    await $.store.set('slaps', s.slaps)
    return kill($, 'knockedOut')
  }
  if (s.slapTimes.length > 1 && Math.random() < DODGE) {
    void playSound($, 'dodge-whoosh.wav')
    const line = book(BOOK.dodged)
    return say($, fill(line.text), line.anim ?? 'GetAttention')
  }
  s.slaps += 1
  s.lbSlaps += 1
  await $.store.set('slaps', s.slaps)
  void playSound($, pick(['slap-crack.wav', 'slap-punch.wav']))
  const line = book(BOOK.slapped)
  await say($, fill(line.text), line.anim ?? 'Alert')
}

async function poke($: EngineInterface) {
  const stone = await read($, grave)
  if (stone === null) return
  const line = book(BOOK.epitaph)
  const now = await $.clock.now()
  await update($, grave, g => (g === null ? g : { ...g, epitaph: fill(line.text, { back: duration(g.until - now) }) }))
}

async function tick($: EngineInterface) {
  const now = await $.clock.now()
  if (s.queued !== null && !s.isAiBusy) {
    const reaction = s.queued
    s.queued = null
    void askHaiku($, reaction)
  }
  if (now >= s.nextIdleAt) {
    s.nextIdleAt = now + between(4, 10) * 60_000
    if (!(await isDead($)) && !(await read($, isHidden)) && now - s.lastSpokeAt > 60_000) {
      const line = book(BOOK.quotes)
      await say($, fill(line.text), line.anim ?? 'Explain')
    }
  }
  if (now - s.lastSeenWrittenAt > 60_000) {
    s.lastSeenWrittenAt = now
    await $.store.set('lastSeen', now)
  }
  await flushLeaderboard($)
}

export const register: Register = (on, options) => {
  opts.clean = options.clean === true
  opts.isAiOn = options.ai !== false
  const lb = String(options.leaderboard ?? '').trim().toLowerCase()
  opts.handle = lb === 'off' ? null : /^[a-z0-9_.-]{1,24}$/.test(lb) ? lb : ANONYMOUS

  on('session.start', async ($, e, next) => {
    const now = await $.clock.now()
    s.kills = Number((await $.store.get('kills')) ?? 0) || 0
    s.slaps = Number((await $.store.get('slaps')) ?? 0) || 0
    const lastSeen = Number((await $.store.get('lastSeen')) ?? 0) || 0
    await $.store.set('lastSeen', now)
    s.nextIdleAt = now + between(2, 5) * 60_000
    s.player = await findPlayer($)

    await $.command.register({
      name: 'clippy',
      description: 'Bring Clippy back, or make him say something. revive raises him from the dead.',
      argumentHint: '[revive]',
    })

    const stone = (await $.store.get('grave')) as Grave | undefined
    if (stone && typeof stone.until === 'number' && stone.until > now) {
      await bury($, stone)
    } else {
      if (stone) await $.store.delete('grave')
      if ((await read($, said)) === null) {
        const line = lastSeen > 0 ? book(BOOK.welcomeBack) : book(BOOK.quotes)
        await say($, fill(line.text, { away: duration(now - lastSeen) }), line.anim ?? 'Wave')
      }
    }

    $.clock.every(1_000, () => void tick($))
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    s.turnStartedAt = await $.clock.now()
    await react($, reactToPrompt(e.text, Math.random()))
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const ms = (await $.clock.now()) - s.turnStartedAt
    if (s.turnStartedAt > 0 && ms >= LONG_TURN_MS) await react($, reactToLongTurn(Math.round(ms / 60_000)))
    s.turnStartedAt = 0
    return next(e)
  })

  // He only watches tool calls: every hook passes the call on untouched and
  // hands back what it got, and a failure of his own never blocks the call.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    await react($, reactToBash(e.command))
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)
    await react($, reactToWrite(e.file_path))
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined) return ran
    s.failures = ran.isError === true ? s.failures + 1 : 0
    if (s.failures === 3) await react($, FAILURES)
    return ran
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'clippy' }, async ($, e) => {
    await update($, isHidden, () => false)
    if (e.args.trim().toLowerCase() === 'revive') {
      return { text: (await revive($)) ? 'Clippy is back from the dead.' : "Clippy isn't dead." }
    }
    const stone = await read($, grave)
    if (stone !== null) {
      const now = await $.clock.now()
      return { text: `Clippy is dead. Back in ${duration(stone.until - now)}, or /clippy revive.` }
    }
    const line = book(BOOK.quotes)
    await say($, fill(line.text), line.anim ?? 'Explain')
    return { text: 'Clippy is back.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const stone = await read($, grave)
    const line = await read($, said)
    if (stone === null && line === null) return next(e)

    const els = $.ui.resolve(e)
    const { Box, Button, Text } = els
    const Svg = 'Svg' in els ? els.Svg : undefined
    // Room around him where there are pixels to spare; a terminal keeps its rows.
    const pad = e.surface === 'desktop'
    const hide = () => {
      void update($, isHidden, () => true)
      $.ui.toast('Clippy is hiding. /clippy brings him back.')
    }

    if (stone !== null) {
      const left = duration(stone.until - (await $.clock.now()))
      return (
        <Box flexDirection="row" gap={pad ? 2 : 1} alignItems="center" paddingX={pad ? 2 : 0} paddingY={pad ? 1 : 0}>
          {Svg ? <Svg source={TOMBSTONE} alt="Clippy's tombstone" width={62} height={47} /> : <Text>🪦</Text>}
          <Box flexDirection="column" flexShrink={1} gap={pad ? 1 : 0}>
            <Text italic dimColor wrap="wrap">
              {stone.epitaph ?? `Here lies Clippy. Back in ${left}.`}
            </Text>
            <Box flexDirection="row" gap={1}>
              <Button key="poke" label="Poke the grave" hotkey="p" onPress={() => void poke($)} />
              <Button key="hide" label="Hide" role="dismiss" onPress={hide} />
            </Box>
          </Box>
        </Box>
      )
    }

    if (line === null) return next(e)
    return (
      <Box flexDirection="row" gap={pad ? 2 : 1} alignItems="center" paddingX={pad ? 2 : 0} paddingY={pad ? 1 : 0}>
        {Svg ? (
          <Svg source={spriteSvg(line.anim, line.id)} alt="Clippy" width={93} height={70} />
        ) : (
          <Text>📎</Text>
        )}
        <Box flexDirection="column" flexShrink={1} gap={pad ? 1 : 0}>
          <Text wrap="wrap">{line.text}</Text>
          <Box flexDirection="row" gap={1}>
            <Button key="slap" label="Slap" hotkey="s" onPress={() => void slap($)} />
            <Button key="kill" label="Kill" hotkey="k" onPress={() => void kill($, 'lastWords')} />
            <Button key="hide" label="Hide" role="dismiss" onPress={hide} />
          </Box>
        </Box>
      </Box>
    )
  })
}
