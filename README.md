# g-claude-code-plugins

A Claude Code plugins marketplace.

This repository can be used in two ways:

- Install full plugins with `/plugin install`
- Install raw skills directly with `npx skills`

## Usage

### Add this marketplace

```bash
/plugin marketplace add Ben2pc/g-claude-code-plugins
```

Or via local path (for development):

```bash
/plugin marketplace add ./
```

### Install a plugin

```bash
/plugin install example-plugin@g-claude-code-plugins
```

Use `/plugin install` when you want the full plugin package, including plugin metadata and any bundled agents or hooks.

### Install skills with `npx skills`

If you only want the raw `SKILL.md` content, you can install skills directly with `npx skills`.

Recommended: use the repository slug (`org/repo`) directly with `npx skills add` for interactive installation. The CLI will discover nested skills in this repo and let you choose what to install.

```bash
# Recommended: interactive installation
npx skills add Ben2pc/g-claude-code-plugins

# Install one skill to Codex
npx skills add Ben2pc/g-claude-code-plugins -a codex -s feishu-channel

# Install all repository skills to Claude Code
npx skills add Ben2pc/g-claude-code-plugins -a claude-code -s '*'

# List available skills without installing
npx skills add Ben2pc/g-claude-code-plugins --list
```

## Available Plugins

| Plugin | Description | Version |
|--------|-------------|---------|
| [example-plugin](./plugins/example-plugin) | An example plugin with skill, agent, and hook | 1.0.0 |
| [feishu-channel](./plugins/feishu-channel) | Connect Claude Code to Feishu via WebSocket — chat, access control, pairing auth | 0.2.0 |
| [claude-remote](./plugins/claude-remote) | Manage Claude Code remote-control sessions in Terminal.app | 0.1.0 |

### Standalone Skills

Skills that live outside plugins, under `skills/` at the repo root:

| Skill | Description |
|-------|-------------|
| [claude-code-agent](./skills/claude-code-agent) | Delegate tasks to an independent Claude Code CLI instance |
| [codex-agent](./skills/codex-agent) | Delegate tasks to Codex (GPT-5.4) via Codex CLI |
| [ip-diagnosis](./skills/ip-diagnosis) | Diagnose public IPv4/IPv6, DNS, route, utun, and WebRTC exposure on macOS + Chrome |
| [deep-review](./skills/deep-review) | Multi-dimensional PR review orchestrator (required + conditional reviewers + punch list) |
| [test-designer](./skills/test-designer) | Independent-Evaluation test designer for TDD red phase |
| [parallel-implementation](./skills/parallel-implementation) | Slice planner for parallel multi-subagent code writing |
| [session-compound](./skills/session-compound) | Compound the current CLI session (Claude Code or Codex) into an interactive HTML report — narrative + token / cache / tool diagnostics + a playground for ticking candidate memory / CLAUDE.md / skill-gap entries to copy back as a prompt |

```bash
npx skills add Ben2pc/g-claude-code-plugins --skill claude-code-agent
npx skills add Ben2pc/g-claude-code-plugins --skill codex-agent
npx skills add Ben2pc/g-claude-code-plugins --skill ip-diagnosis
npx skills add Ben2pc/g-claude-code-plugins --skill deep-review
npx skills add Ben2pc/g-claude-code-plugins --skill test-designer
npx skills add Ben2pc/g-claude-code-plugins --skill parallel-implementation
npx skills add Ben2pc/g-claude-code-plugins --skill session-compound
```

### Feishu / Lark Skills

The `g-feishu` plugin has been removed. For Feishu (Lark) API integration, use the official **[lark-cli](https://github.com/larksuite/cli)** and its skills:

```bash
# Install lark-cli globally
npm install -g @larksuite/cli

# Install lark skills (interactive — pick what you need)
npx skills add larksuite/cli

# Or install specific skills directly
npx skills add larksuite/cli --skill lark-im -a claude-code -y
npx skills add larksuite/cli --skill lark-doc -a claude-code -y
```

### CLI Tools

| Package | Description | Install |
|---------|-------------|---------|
| [@ben1849/feishu-channel](./feishu-channel-cli) | Sandbox profile manager for feishu-channel | `npx @ben1849/feishu-channel sandbox` |

## Plugin Structure

```
plugins/
└── my-plugin/
    ├── .claude-plugin/
    │   └── plugin.json       # Plugin manifest
    ├── skills/
    │   └── my-skill/
    │       └── SKILL.md      # Skill definition
    ├── agents/
    │   └── my-agent.md       # Agent definition
    └── hooks/
        └── hooks.json        # Event hooks
```

## Adding a New Plugin

1. Create a directory under `plugins/`
2. Add `.claude-plugin/plugin.json`
3. Add skills, agents, hooks as needed
4. Register it in `.claude-plugin/marketplace.json`

## Local Development

Load a single plugin directly for development:

```bash
claude --plugin-dir ./plugins/my-plugin
```

After editing files, reload without restarting:

```bash
/reload-plugins
```

## Contributing

Submit a PR with your plugin following the structure above.
