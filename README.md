# Inappropriate Clippy for Claude Code

Clippy in the band above your Claude Code prompt, heckling you and your agent. A
[mod](https://claude.com/blog/claude-code-mods) for the CLI and the desktop app.
Same paperclip as the [Omarchy one](https://github.com/CostaFot/omarchy-inappropriate-clippy),
same lines, same graveyard.

## Install

In a terminal session:

```
/plugin install inappropriate-clippy --marketplace CostaFot/claude-inappropriate-clippy
```

Installed at the user scope, he also shows up in the desktop app's Code tab.

## What he does

| | |
|---|---|
| Nothing | a line from the book every 4–10 minutes |
| Your agent runs `rm -rf`, a force push, `reset --hard`, `--no-verify`, `curl \| sh`, `chmod 777`, `sudo`, `npm install`, a `fix` commit | a line about it |
| Your agent writes a `TODO.md`, `PLAN.md`, `IDEAS.md` or `ROADMAP.md` | a line about it |
| Three failed tool calls in a row, or a turn over 5 minutes | a line about it |
| You type `fix it`, `continue`, `please`, `thanks` and the like | sometimes, a line about it |
| Slap (`s`) | a slap, counted. Sometimes he dodges |
| Ten slaps in six seconds, or Kill (`k`) | dead for 5 minutes under a tombstone. Poke the grave for an epitaph |
| Hide | gone for the session |

He watches tool calls and never blocks or changes one.

## Commands

| | |
|---|---|
| `/clippy` | brings him back after Hide, or makes him say something |
| `/clippy revive` | back from the dead now |

## Configuration

In `/config`, under the plugin:

| Option | Default | |
|---|---|---|
| `leaderboard` | empty | Your handle on [the graveyard](https://graveyard.costafotiadis.com). Empty posts to the shared `anonymous-clippy-abuser` stone, `off` posts nothing |
| `clean` | `false` | No swearing |
| `ai` | `true` | Lines from Haiku about what just happened. Off, he only speaks from the book |

## Limitations

- The animated sprite draws in the desktop app. A terminal gets 📎 and the text.
- AI lines run on your own Claude usage, one Haiku call every 30 seconds at most.
- The leaderboard gets a handle and two counts (slaps, kills), nothing else.
- Mods are early access in Claude Code. Built against 2.1.295.
