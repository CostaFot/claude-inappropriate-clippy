import type { Line } from '../types'

// What Clippy reacts to. `fact` is what Haiku is told happened; `lines` are
// what he says when there is no Haiku (ai off, rate-limited, or it failed).

export type Reaction = { fact: string; lines: readonly Line[] }

type Rule = { test: RegExp; fact: string; lines: readonly Line[] }

const BASH: readonly Rule[] = [
  {
    test: /\brm\s+-[a-zA-Z]*(r[a-zA-Z]*f|f[a-zA-Z]*r)/,
    fact: 'their coding agent just ran rm -rf',
    lines: [
      { text: "It looks like you're deleting things with -rf. Want help making it permanent?", nsfw: false, anim: 'Alert' },
      { text: 'rm -rf with no backup and no hesitation. Your agent has bigger balls than you do.', nsfw: true, anim: 'GetAttention' },
    ],
  },
  {
    test: /\bgit\s+push\b.*\s(--force(-with-lease)?|-f)\b/,
    fact: 'their coding agent just force-pushed',
    lines: [
      { text: 'Force push. Rewriting history like a dictator with a laptop.', nsfw: false, anim: 'Alert' },
      { text: 'Force push. Somewhere a teammate just felt a cold fucking chill.', nsfw: true, anim: 'GetAttention' },
    ],
  },
  {
    test: /\bgit\s+reset\s+--hard\b/,
    fact: 'their coding agent just ran git reset --hard',
    lines: [{ text: "git reset --hard. The 'I give up' button, pressed by a robot on your behalf.", nsfw: false, anim: 'EmptyTrash' }],
  },
  {
    test: /--no-verify\b/,
    fact: 'their coding agent just skipped the git hooks with --no-verify',
    lines: [{ text: '--no-verify. The hooks were written for exactly this kind of person.', nsfw: false, anim: 'Explain' }],
  },
  {
    test: /\bcurl\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b/,
    fact: 'their coding agent just piped curl into a shell',
    lines: [{ text: "Piping curl into a shell. Living the dream, one stranger's script at a time.", nsfw: false, anim: 'Alert' }],
  },
  {
    test: /\bchmod\s+(-R\s+)?777\b/,
    fact: 'their coding agent just ran chmod 777',
    lines: [{ text: 'chmod 777. Security is for people with something worth stealing.', nsfw: false, anim: 'Explain' }],
  },
  {
    test: /\bsudo\s/,
    fact: 'their coding agent just ran a command with sudo',
    lines: [{ text: "It looks like you're giving the robot root. Want help writing the incident report?", nsfw: false, anim: 'GetAttention' }],
  },
  {
    test: /\bgit\s+commit\b.*\s-m\s*["']?(fix|wip|update|changes|stuff)["']?\s*$/i,
    fact: "their coding agent just wrote a one-word commit message like 'fix'",
    lines: [{ text: "'fix'. A commit message for the ages. Historians will weep.", nsfw: false, anim: 'Writing' }],
  },
  {
    test: /\b(npm\s+(i|install)|pnpm\s+(add|i|install)|yarn\s+add|bun\s+add)\b/,
    fact: 'their coding agent just installed more npm packages',
    lines: [{ text: 'Another npm package. Your node_modules has its own weather now.', nsfw: false, anim: 'Searching' }],
  },
]

export function reactToBash(command: string): Reaction | undefined {
  const rule = BASH.find(r => r.test.test(command))
  return rule && { fact: `${rule.fact}: ${command.slice(0, 200)}`, lines: rule.lines }
}

const LIST_FILE = /(^|\/)(TODO|TODOS|PLAN|IDEAS|ROADMAP)\.md$/i

export function reactToWrite(path: string): Reaction | undefined {
  if (!LIST_FILE.test(path)) return undefined
  return {
    fact: `their coding agent just wrote a list file nobody will read: ${path}`,
    lines: [{ text: "It looks like you're writing a TODO list. You'll never read it, but the gesture's nice.", nsfw: false, anim: 'Writing' }],
  }
}

export const FAILURES: Reaction = {
  fact: 'three tool calls in a row just failed for their coding agent',
  lines: [
    { text: "Three failures in a row. I'd help, but watching is so much better.", nsfw: false, anim: 'Thinking' },
    { text: "Three fuckups in a row, and that's just the ones the robot admitted to.", nsfw: true, anim: 'GetAttention' },
  ],
}

export function reactToLongTurn(minutes: number): Reaction {
  return {
    fact: `they just waited ${minutes} minutes for their coding agent to finish one request`,
    lines: [{ text: `${minutes} minutes for that. I could've bent myself into the answer faster.`, nsfw: false, anim: 'Processing' }],
  }
}

// Prompts get a chance, not a certainty: every "please" would wear thin.
export function reactToPrompt(text: string, roll: number): Reaction | undefined {
  const words = text.trim()
  if (/^(fix it|do it|go|continue|yes|ok|try again|again)[.!]*$/i.test(words) && roll < 0.5) {
    return {
      fact: `they just told their coding agent, in full: "${words}"`,
      lines: [{ text: `'${words}'. Incredible spec. Truly a product mind at work.`, nsfw: false, anim: 'Explain' }],
    }
  }
  if (/\bplease\b/i.test(words) && roll < 0.35) {
    return {
      fact: 'they just said please to their coding agent',
      lines: [{ text: "Saying please to a language model. It doesn't love you back.", nsfw: false, anim: 'Explain' }],
    }
  }
  if (/^(thanks|thank you|ty)\b/i.test(words) && roll < 0.35) {
    return {
      fact: 'they just thanked their coding agent',
      lines: [{ text: "Thanking the robot. It'll still replace you, but politely.", nsfw: false, anim: 'Wave' }],
    }
  }
  return undefined
}
