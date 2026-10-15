/** One line from the book: quotes.json in omarchy-inappropriate-clippy. */
export type Line = { text: string; nsfw: boolean; anim?: string }

/** What Clippy is saying now. `id` restarts his animation on every new line. */
export type Said = { text: string; anim: string; id: number }

/** He is dead until `until` (ms since the epoch). */
export type Grave = { until: number; epitaph: string | null }

declare module 'claude-code' {
  interface PluginState {
    'inappropriate-clippy': {
      said: Said | null
      grave: Grave | null
      isHidden: boolean
    }
  }
}
