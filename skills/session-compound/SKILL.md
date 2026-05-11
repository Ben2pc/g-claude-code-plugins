---
name: session-compound
description: 把当前 CLI 会话（Claude Code 或 Codex）复盘成一份单文件交互 HTML 报告——叙事、token / cache / 工具健康度，以及 playground 风格的「可勾选候选条目」面板（候选 memory / CLAUDE.md 增补 / skill 缺口），勾选后一键复制成提示词粘回 Claude / Codex 直接落库。适用于一段实质性工作之后，用户想沉淀这次会话。
---

# Session Compound

把单次 CLI 会话压缩成一份保存在当前目录下、可离线打开的 HTML 报告。报告分三个 tab：

- **Narrative** — 这次做了什么（时间线 + 关键反馈时刻 + Agent 撰写的叙事摘要）
- **Health** — token / cache / 工具用量诊断
- **Compound** — playground：左侧候选条目列表（可勾选 + 行内编辑），右侧实时合成 markdown，底部一键复制「提示词」，粘回 Claude / Codex 让 agent 按规则落库

## 何时使用

- 用户要求「复盘 / 总结 / 沉淀 / wrap up」当前会话
- 用户显式调用 `/session-compound` 或类似命令
- 用户想从这次会话里提取 memory 条目、CLAUDE.md 增补、或可抽象的 skill 缺口

**不要**用于跨会话分析——那是 `session-report` 插件的范围（最近 7 天 × 全部项目）。

---

## 工作流

### 步骤 1：跑 analyzer

你自己知道你是 Claude Code 还是 Codex。**根据你的身份**，从两组指令里选一组执行。

#### 如果你是 Claude Code

```sh
node <skill-dir>/analyzers/claude-code.mjs > /tmp/session-compound.json
```

`<skill-dir>` 是这份 SKILL.md 所在目录的绝对路径。

脚本会自动通过 `CLAUDE_CODE_SESSION_ID` 环境变量 + 当前 cwd 推断出 `~/.claude/projects/<cwd-slug>/<session-id>.jsonl`。可选 override：
- `--session-id <uuid>` — 指定会话 id
- `--file <abs-path>` — 直接指定 JSONL 文件路径

#### 如果你是 Codex

```sh
node <skill-dir>/analyzers/codex.mjs > /tmp/session-compound.json
```

脚本会从 `CODEX_THREAD_ID` 环境变量读 thread id，然后在 `~/.codex/sessions/**/rollout-*-<thread-id>.jsonl` 下定位文件。可选 override：
- `--thread-id <uuid>` — 指定 thread id
- `--file <abs-path>` — 直接指定 rollout JSONL 文件路径

#### 通用约束

如果 analyzer 非零退出，读 stderr、对症修正（错路径、缺会话、文件未生成等）后重跑。**未拿到 JSON 不要继续后续步骤**。

### 步骤 2：读 JSON 摘要

读 `/tmp/session-compound.json`。重点扫这些字段：

- `session` — id / cwd / 时长 / 模型 / git
- `narrative.human_turns` — 用户每个 turn 的摘要 + token + 触发的工具
- `narrative.feedback_moments` — 检测到的用户纠正/反馈瞬间
- `health.tokens` / `health.cache_hit_rate` / `health.context_window_used_pct`
- `health.tools` / `health.subagents` / `health.skills`（Codex 后两项通常为空）
- `health.expensive_turns` — token 消耗最高的 turn
- `health.waste_signals` — 重复读同文件、低 cache 命中等浪费信号
- `raw_for_compound` — 用来写候选条目的原材料

两套 analyzer 的输出 schema 完全一致，差异只在 `cli` 字段和少数 CLI-specific 字段（如 `reasoning_output`、`context_window_used_pct`）。

### 步骤 3：复制模板到输出文件

```sh
cp <skill-dir>/template.html ./session-compound-$(date +%Y%m%d-%H%M).html
```

### 步骤 4：注入数据 + 撰写 Agent 填空段（**用 Edit，不用 Write**——必须保留模板的 JS/CSS）

需要做 4 处编辑：

#### 4a. 替换 `<script id="report-data">` 的内容

把这块的内容替换成步骤 1 产出的完整 JSON：

```html
<script id="report-data" type="application/json">
{ "cli": "claude-code", ... }
</script>
```

模板的 JS 会自动从这个 JSON 渲染 hero、所有表格、bar、时间线。

#### 4b. 填 `<!-- AGENT: narrative-summary -->` 块

把这个 div：
```html
<div id="narrative-summary" class="empty-hint">No summary yet — ...</div>
```
替换为：
```html
<div id="narrative-summary">这里写 ≤3 句话的会话叙事摘要</div>
```

摘要要求：**事实性**。引用真实的 turn 内容、真实的决策、真实的工具模式——不要套话。

#### 4c. 填 `<!-- AGENT: anomalies -->` 块

把 `<div class="takes" id="anomalies">...</div>` 内的占位 hint 替换为 **3–5 张 take 卡片**。数值尽量用「占总 token 的 %」表达。精确 markup：

```html
<div class="take bad"><div class="fig">62%</div><div class="txt">Turn <b>#4</b> 一个 prompt 消耗了 62% 的总 token</div></div>
```

class 含义：
- `.take.bad` — 浪费 / 红
- `.take.good` — 健康信号 / 绿
- `.take.warn` — 警示 / 黄
- `.take.info` — 中性事实 / 蓝

`.fig` 是一个短数字（%、计数、或 `12×` 倍数）。`.txt` 是一句白话，主语用 `<b>` 包起来。

可发掘的角度：
- 单个 turn 占了不成比例的份额
- Cache hit < 85%（Claude）或 reasoning 占 output > 50%（Codex）
- 反复读同一个文件
- 子 agent 调用没有输出格式约束
- Context window 接近上限（Codex）

#### 4d. 填 `<script id="candidates">` 数组（**本 skill 的核心价值**）

把那个 script tag 里的 `[]` 替换为候选条目数组。每个条目是用户可能想保留的一项：memory 条目、CLAUDE.md 增补、或 skill 缺口。

Schema：
```json
[
  {
    "name": "kebab-case-name",
    "type": "feedback | project | reference | user | claude-md | skill-gap",
    "body": "条目正文 markdown——直接落库的文本",
    "default_selected": true
  }
]
```

type 语义（遵循全局 auto-memory 规范）：

- **`feedback`** — 用户对你给的纠正 / 偏好。正文结构：先写规则，再写 `**Why:**` 和 `**How to apply:**` 两行
- **`project`** — 关于在做的项目的事实（截止日期、相关人、决策）。正文同 feedback 结构
- **`reference`** — 外部系统的指针（Linear 项目、Grafana 看板、Slack 频道）
- **`user`** — 关于用户本人的角色 / 专长 / 偏好
- **`claude-md`** — 对某个 `CLAUDE.md` 的具体修改。正文：哪个文件 + 准确插入或修改的内容
- **`skill-gap`** — 这次会话里出现了重复模式，可以抽象成新 skill。正文：描述这个缺口 + 一个 skill 应该做什么

**原材料**来自 JSON 的 `raw_for_compound`：feedback 瞬间、重复读文件、子 agent 调用、turn 时间线。`feedback` 类条目用 `narrative.feedback_moments` 里的原话当起点。`project` 类条目从 `human_turns` 提炼。

**质量标准**：宁少勿滥。**3–8 条高价值候选** 胜过 20 条平庸候选。明显的别写——只保留**未来某次会话**会真正用到的。

### 步骤 5：报告输出路径

把保存的绝对路径报告给用户。**不要**打开它、**不要**预渲染。用户自己打开、在 Compound tab 勾选、行内编辑措辞、点 Copy，把生成的提示词粘回 Claude / Codex 那一句话就完成落库。

---

## 备注

- 模板 JS 只读两个 script block：`<script id="report-data">`（analyzer 输出）和 `<script id="candidates">`（你撰写的候选）。其余渲染都靠这两个 blob 驱动。**不要改 HTML 结构**。
- Compound tab 是这个 skill 区别于普通 session report 的核心价值——把「AI 提取候选 → 人审核 → 落入 memory」做成了无摩擦闭环。
- Codex 有原生 sub-agent（`spawn_agent` / `wait_agent` / `close_agent` 工具调用），analyzer 会把 `agent_type` 汇总到 `health.subagents`。Codex 没有 skill 概念，模板会隐藏对应表格。
- Codex 的 `health` 段额外含：`compaction_count`（自动压缩次数）、`patch_apply.{success, failure}`（代码修改成败比）、`mcp_tool_call_count` / `custom_tool_call_count` / `web_search_count` / `tool_search_count` / `image_generation_count` 等专项工具计数，以及 `context_window`（模型窗口大小）。
- 如果 `raw_for_compound` 很稀（会话短、没反馈瞬间），宁可产出 1–3 条高质量 `skill-gap`，也不要硬凑 5 条。
- 如果 JSON 超过 2MB，截断 `narrative.human_turns` 和 `health.expensive_turns` 到前 50 条再嵌入（analyzer 通常已经控制了，但要检查）。
