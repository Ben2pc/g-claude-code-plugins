import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_ROOT = path.join(ROOT, "skills", "claude-code-agent");

function read(relativePath) {
  return fs.readFileSync(path.join(SKILL_ROOT, relativePath), "utf8");
}

test("claude-code-agent skill keeps prompt references discoverable from SKILL.md", () => {
  const source = read("SKILL.md");

  assert.match(source, /^---\nname: claude-code-agent\n/m);
  assert.match(source, /description: .*Claude Code CLI/);
  assert.match(source, /Agent SDK/);
  assert.match(source, /## Prompt References/);
  assert.match(source, /\[references\/task-prompt-recipes\.md\]/);
  assert.match(source, /\[references\/review-prompt-recipes\.md\]/);
  assert.match(source, /\[references\/delegation-prompt-recipes\.md\]/);
  assert.match(source, /`stream-json` \*\*必须配 `--verbose`\*\*/);
  assert.match(source, /structured_output/);
  assert.match(source, /`result` 可能为空/);
  assert.match(source, /`--continue` 自动续接当前目录最近一次会话/);
  assert.match(source, /cat logs\.txt \| claude -p/);
  assert.match(source, /`--bare`/);
  assert.match(source, /不是稳定的中途增量入口/);
  assert.match(source, /`Not logged in`/);
  assert.match(source, /`--max-turns`/);
  assert.match(source, /不要依赖 `\/commit` 之类交互式 slash commands/);
  assert.match(source, /`--worktree`/);
});

test("task prompt references cover diagnosis, narrow fix, worktree isolation, frontend, and follow-up reuse", () => {
  const source = read("references/task-prompt-recipes.md");

  assert.match(source, /^# Task Prompt Recipes$/m);
  assert.match(source, /^## Diagnosis$/m);
  assert.match(source, /^## Narrow Fix$/m);
  assert.match(source, /^## Planning Or Recon Pass$/m);
  assert.match(source, /^## Worktree-Isolated Implementation$/m);
  assert.match(source, /^## Frontend Implementation$/m);
  assert.match(source, /^## Structured Output For A Parent Agent$/m);
  assert.match(source, /^## Follow-Up On The Same Claude Session$/m);
  assert.match(source, /<verification_loop>/);
  assert.match(source, /<missing_context_gating>/);
  assert.match(source, /<handoff_contract>/);
  assert.match(source, /<solution_quality>/);
  assert.match(source, /<design_thesis>/);
  assert.match(source, /<first_viewport_rule>/);
  assert.match(source, /propose 4 distinct visual directions/);
});

test("review and delegation references cover adversarial review and worker handoff contracts", () => {
  const review = read("references/review-prompt-recipes.md");
  const delegation = read("references/delegation-prompt-recipes.md");

  assert.match(review, /^# Review Prompt Recipes$/m);
  assert.match(review, /^## Default Review$/m);
  assert.match(review, /^## Adversarial Review$/m);
  assert.match(review, /^## Missing Tests Pass$/m);
  assert.match(review, /^## Contract Drift Review$/m);
  assert.match(review, /ship\/no-ship summary/);
  assert.match(review, /<coverage_over_filtering>/);
  assert.match(review, /coverage stage, not a filtering stage/);
  assert.match(review, /severity and confidence labels per finding/);

  assert.match(delegation, /^# Delegation Prompt Recipes$/m);
  assert.match(delegation, /^## Independent Worker With Final Handoff$/m);
  assert.match(delegation, /^## Repository Recon Only$/m);
  assert.match(delegation, /^## Continue Existing Session With Delta Instructions$/m);
  assert.match(delegation, /^## Session Rescue Or Recovery$/m);
  assert.match(delegation, /<scope_guardrails>/);
  assert.match(delegation, /<handoff_contract>/);
});
