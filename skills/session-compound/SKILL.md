---
name: session-compound
description: Generate a single-file interactive HTML report that recaps the CURRENT CLI session (Claude Code or Codex) — narrative, token / cache / tool health, and a playground-style sheet of candidate memory entries / CLAUDE.md edits / skill gaps you can review, edit, and copy back as a prompt. Use after a substantive session when the user wants to compound what they just learned.
---

# Session Compound

Compound a single CLI session into a self-contained HTML report saved in the current working directory. The report has three tabs: **Narrative** (what happened), **Health** (token / cache / tool diagnostics), and **Compound** (a playground that lets the user check off candidate memory / CLAUDE.md / skill-gap entries and copy a ready-to-paste prompt back into Claude / Codex).

## When to use

- The user asks to "compound", "recap", "review", or "wrap up" the current session.
- The user explicitly invokes `/session-compound` or asks for "this session's report".
- The user wants to extract memory entries, CLAUDE.md edits, or skill ideas from what just happened.

Do **not** use for cross-session analytics — that is what the `session-report` plugin is for (last 7 days across all projects).

## Steps

### 1. Pick the CLI

Detect which CLI's session to analyze. Default order:

1. If the user passes `--cli claude-code` or `--cli codex`, use it.
2. Else if `$CLAUDE_CODE_SESSION_ID` is set in the environment (you are running inside Claude Code), use **claude-code**.
3. Else if `~/.codex/state_5.sqlite` exists, use **codex**.
4. Else fail with a clear message.

### 2. Run the matching analyzer

The analyzers live next to this SKILL.md in `analyzers/`. Resolve the absolute path of the skill directory (the dir containing this file) and run the right one:

```sh
# Claude Code (auto-locates current session via CLAUDE_CODE_SESSION_ID + cwd slug)
node <skill-dir>/analyzers/claude-code.mjs > /tmp/session-compound.json

# Codex (auto-locates most recently active thread from ~/.codex/state_5.sqlite)
node <skill-dir>/analyzers/codex.mjs > /tmp/session-compound.json
```

Both analyzers accept these overrides:
- `--session-id <id>` — pin to a specific session
- `--file <abs-path>` — point directly at a JSONL file

If the analyzer exits non-zero, read its stderr, fix the obvious cause (wrong cli, missing env var, no session yet), and re-run. Do NOT proceed past this step without a JSON file.

### 3. Read the JSON

Read `/tmp/session-compound.json`. Skim: `session`, `narrative.human_turns`, `narrative.feedback_moments`, `health.tokens`, `health.tools`, `health.expensive_turns`, `health.waste_signals`, `raw_for_compound`. The output schema is the same for both analyzers — only the `cli` field and a few CLI-specific fields (`reasoning_output`, `context_window_used_pct`) differ.

### 4. Copy the template

```sh
cp <skill-dir>/template.html ./session-compound-$(date +%Y%m%d-%H%M).html
```

### 5. Inject data + author the Agent-filled sections

Use **Edit** (not Write — preserve the template's JS/CSS) to make four changes to the output file:

#### 5a. Replace the report-data JSON

Find this block:
```html
<script id="report-data" type="application/json">
{ "cli": "claude-code", ... }
</script>
```
Replace its contents with the full JSON from step 3. The template renders the hero, all tables, bars, and timelines from this blob automatically.

#### 5b. Fill `<!-- AGENT: narrative-summary -->`

Replace the `<div id="narrative-summary" class="empty-hint">...</div>` with a plain `<div id="narrative-summary">` containing **≤3 sentences** telling the story of this session. Reference real human turns, real decisions, real tool patterns from the data — not generic platitudes.

#### 5c. Fill `<!-- AGENT: anomalies -->`

Replace the `<div class="takes" id="anomalies">...</div>` contents with **3–5 take cards**. Express figures as a % of total tokens wherever possible. Exact markup:

```html
<div class="take bad"><div class="fig">62%</div><div class="txt">Turn <b>#4</b> alone consumed 62% of total tokens — one prompt drove the entire run</div></div>
```

Classes: `.take.bad` (waste / red), `.take.good` (healthy / green), `.take.warn` (caution / amber), `.take.info` (neutral / blue). The `.fig` is one short number (%, count, or `12×` multiplier). The `.txt` is one plain sentence with the subject wrapped in `<b>`.

Look for: a turn eating a disproportionate share; cache hit rate < 85% (claude) or low reasoning ratio (codex); repeated reads of the same file; subagent calls without an output-format contract; long uninterrupted runs; context window approaching limit (codex).

#### 5d. Fill `<script id="candidates">` with structured compound candidates

This is the highest-leverage step. Replace the `[]` inside that script tag with an array of candidate objects. Each candidate is one entry the user might want to keep — a memory, a CLAUDE.md edit, or a skill gap.

Schema:
```json
[
  {
    "name": "kebab-case-name",
    "type": "feedback | project | reference | user | claude-md | skill-gap",
    "body": "markdown body of the entry — the actual text to save",
    "default_selected": true
  }
]
```

Type semantics:
- **`feedback`** — corrections / preferences the user gave you. Body: lead with the rule, then `**Why:**` and `**How to apply:**` lines (per the global auto-memory convention).
- **`project`** — facts about ongoing work, deadlines, stakeholders, decisions. Body: same `**Why:** / **How to apply:**` structure.
- **`reference`** — pointers to external systems (Linear projects, Grafana boards, Slack channels).
- **`user`** — facts about who the user is, their role, expertise, preferences.
- **`claude-md`** — a specific addition or edit to a `CLAUDE.md` file. Body: state which file and the exact lines to add / change.
- **`skill-gap`** — a repeated pattern that could be abstracted into a new skill. Body: describe the gap and what a skill would do.

**Source material** comes from `raw_for_compound` in the JSON: feedback moments, repeated reads, subagent invocations, the turn timeline. Use the actual user words from `narrative.feedback_moments` to write `feedback` entries. Use `human_turns` summaries to derive `project` entries.

**Quality bar:** be selective. 3–8 high-signal candidates beats 20 mediocre ones. Skip the obvious; only include what would be useful in a *future* session.

### 6. Report the saved file path to the user

Don't open the file. Don't render it. Just print the absolute path. The user opens it themselves, ticks candidates in the Compound tab, edits any wording, and clicks Copy to bring the result back into Claude / Codex.

## Notes

- The template's JS reads two blocks: `<script id="report-data">` (analyzer output) and `<script id="candidates">` (your authored candidates). The rest of the page renders from those two blobs. Don't restructure the HTML.
- The Compound tab is the unique value of this skill versus a regular session report — it's a playground that turns "AI extracts candidates → human reviews → entries land in memory" into one frictionless flow.
- Codex sessions have no native subagent / skill concept. The template hides those sections automatically when `data.cli === 'codex'`.
- If `raw_for_compound` is sparse (short session, no feedback moments), produce 1–3 high-quality `skill-gap` candidates instead of forcing 5 mediocre ones.
- If the JSON is large (>2MB), truncate `narrative.human_turns` and `health.expensive_turns` to the top 50 before embedding — they should already be capped, but check.
