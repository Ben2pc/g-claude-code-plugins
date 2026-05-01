import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_ROOT = path.join(ROOT, "skills", "gemini-agent");

function read(relativePath) {
  return fs.readFileSync(path.join(SKILL_ROOT, relativePath), "utf8");
}

test("gemini-agent skill keeps prompt references discoverable from SKILL.md", () => {
  const source = read("SKILL.md");

  assert.match(source, /^---\nname: gemini-agent\n/m);
  assert.match(source, /description: .*Gemini CLI/);
  assert.match(source, /## Prompt References/);
  assert.match(source, /\[references\/task-prompt-recipes\.md\]/);
  assert.match(source, /\[references\/review-prompt-recipes\.md\]/);
  assert.match(source, /\[references\/delegation-prompt-recipes\.md\]/);
  assert.match(source, /默认 prompt 模板/);
  assert.match(source, /`-p, --prompt`/);
  assert.match(source, /强制.*非交互模式/);
  assert.match(source, /--output-format/);
  assert.match(source, /stream-json/);
  assert.match(source, /--approval-mode/);
  assert.match(source, /auto_edit/);
  assert.match(source, /`plan`/);
  assert.match(source, /`yolo`/);
  assert.match(source, /-r, --resume/);
  assert.match(source, /`-r latest`/);
  assert.match(source, /--list-sessions/);
  assert.match(source, /--delete-session/);
  assert.match(source, /cat logs\.txt \| gemini -p/);
  assert.match(source, /cat \.\/prompt\.md \| gemini --output-format json/);
  assert.match(source, /cat \/tmp\/task-prompt\.md \| gemini \\/);
  assert.match(source, /Not enough arguments following: p/);
  assert.match(source, /追加到 stdin 内容之后/);
  assert.match(source, /TTY 下默认进交互模式/);
  assert.match(source, /`-p` 必须带字符串参数/);
  assert.match(source, /`pro`/);
  assert.match(source, /`flash`/);
  assert.match(source, /`flash-lite`/);
  assert.match(source, /`auto`/);
  assert.match(source, /--worktree/);
  assert.match(source, /experimental\.worktrees: true/);
  assert.match(source, /已废弃/);
  assert.match(source, /--yolo/);
  assert.match(source, /--allowed-tools/);
  assert.match(source, /gemini extensions/);
  assert.match(source, /gemini mcp/);
  assert.match(source, /gemini skills/);
  assert.match(source, /Policy Engine/);

  assert.match(source, /non-TTY/);
  assert.match(source, /"response":/);
  assert.match(source, /"stats":/);
  assert.match(source, /"session_id":/);
  assert.match(source, /`init`/);
  assert.match(source, /`message`/);
  assert.match(source, /`tool_use`/);
  assert.match(source, /`tool_result`/);
  assert.match(source, /`result`/);
  assert.match(source, /## 退出码/);
  assert.match(source, /`42`/);
  assert.match(source, /`53`/);
  assert.match(source, /超过 turn 上限/);
  assert.match(source, /优先取 `response` 字段/);
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
  assert.match(source, /^## Follow-Up On The Same Gemini Session$/m);
  assert.match(source, /<verification_loop>/);
  assert.match(source, /<missing_context_gating>/);
  assert.match(source, /<handoff_contract>/);
  assert.match(source, /<solution_quality>/);
  assert.match(source, /<design_thesis>/);
  assert.match(source, /<first_viewport_rule>/);
  assert.match(source, /gemini -r latest/);
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
  assert.match(review, /--approval-mode plan/);
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
