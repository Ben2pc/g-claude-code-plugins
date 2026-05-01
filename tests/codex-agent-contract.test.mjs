import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_ROOT = path.join(ROOT, "skills", "codex-agent");

function read(relativePath) {
  return fs.readFileSync(path.join(SKILL_ROOT, relativePath), "utf8");
}

test("codex-agent skill keeps prompt references discoverable from SKILL.md", () => {
  const source = read("SKILL.md");

  assert.match(source, /^---\nname: codex-agent\n/m);
  assert.match(source, /description: .*Codex CLI/);
  assert.match(source, /## Prompt References/);
  assert.match(source, /\[references\/task-prompt-recipes\.md\]/);
  assert.match(source, /\[references\/review-prompt-recipes\.md\]/);
  assert.match(source, /\[references\/browser-research-prompt-recipes\.md\]/);
  assert.match(source, /默认 prompt 模板/);
  assert.match(source, /本机浏览器调研（既要事件流，也要最终答案落盘）/);
  assert.match(source, /区分 `-o` 和 `--json` 的职责/);
  assert.match(source, /长 prompt 用 stdin 管道/);
  assert.match(source, /Reading additional input from stdin/);
  assert.match(source, /prompt 超过约 500 字符或包含多行\/特殊字符时，不要继续用位置参数/);
  assert.match(source, /--skip-git-repo-check - < \/tmp\/task-prompt\.txt/);
});

test("task prompt references cover diagnosis, narrow fix, frontend, and follow-up reuse", () => {
  const source = read("references/task-prompt-recipes.md");

  assert.match(source, /^# Task Prompt Recipes$/m);
  assert.match(source, /^## Diagnosis$/m);
  assert.match(source, /^## Narrow Fix$/m);
  assert.match(source, /^## Planning Or Design Pass$/m);
  assert.match(source, /^## Frontend Implementation$/m);
  assert.match(source, /^## Structured Output To Feed Another Tool$/m);
  assert.match(source, /^## Prompt-Patching$/m);
  assert.match(source, /^## Follow-Up On The Same Codex Thread$/m);
  assert.match(source, /<verification_loop>/);
  assert.match(source, /<missing_context_gating>/);
  assert.match(source, /<solution_quality>/);
  assert.match(source, /<design_thesis>/);
  assert.match(source, /<first_viewport_rule>/);
  assert.match(source, /low or medium reasoning/);
  assert.match(source, /Playwright MCP server or skill/);
  assert.match(source, /targeted unit tests for the changed behavior/);
  assert.match(source, /each requirement traced to where it gets addressed/);
});

test("review and browser references cover adversarial review and computer-use research", () => {
  const review = read("references/review-prompt-recipes.md");
  const browser = read("references/browser-research-prompt-recipes.md");

  assert.match(review, /^# Review Prompt Recipes$/m);
  assert.match(review, /^## Default Review$/m);
  assert.match(review, /^## Adversarial Review$/m);
  assert.match(review, /^## Missing Tests Pass$/m);
  assert.match(review, /^## Contract Drift Review$/m);
  assert.match(review, /ship\/no-ship summary/);
  assert.match(review, /<coverage_over_filtering>/);
  assert.match(review, /coverage stage, not a filtering stage/);
  assert.match(review, /severity and confidence labels per finding/);

  assert.match(browser, /^# Browser Research Prompt Recipes$/m);
  assert.match(browser, /^## Community Signal Sampling$/m);
  assert.match(browser, /^## Product Workflow Observation$/m);
  assert.match(browser, /^## Evidence-First Chinese Summary$/m);
  assert.match(browser, /^## Retrieval Budget$/m);
  assert.match(browser, /^## Safety Tail$/m);
  assert.match(browser, /Use Computer Use on my Mac/);
  assert.match(browser, /Do not modify local files/);
  assert.match(browser, /Treat each search or page open as a budgeted action/);
});
