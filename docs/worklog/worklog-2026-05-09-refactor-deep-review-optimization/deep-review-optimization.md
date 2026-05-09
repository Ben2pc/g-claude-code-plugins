# Spec：deep-review 优化

**状态：** 草稿 · **分支：** `refactor/deep-review-optimization` · **日期：** 2026-05-09

## 目标

把 `skills/deep-review/SKILL.md`（当前 173 行，单文件臃肿）重构为「精简编排器 + 每个 reviewer 独立 reference 文件」，并打包成可分发的 marketplace 插件；同时借鉴 Anthropic `pr-review-toolkit` 中最有价值的清单去强化我们的 reviewer 提示词，但**不**继承它的「过滤式」写法（在 Opus 4.7 上会导致漏报）。

## 为什么要做

- **CLAUDE.md 原则：** 指令文件应该是目录而非百科全书。当前 SKILL.md 把编排逻辑和 80 多行 reviewer 提示词混在一起。
- **可分发性：** 当前位于顶层 `skills/`，没有写进 `marketplace.json`，外部用户无法 `/plugin install`。
- **覆盖度差距：** 我们在错误处理、注释/文档同步、类型设计这几个维度的清单比 `pr-review-toolkit` 粗，借鉴它们的具体清单可以提升召回。**UX reviewer 完全没覆盖 accessibility 和 responsive design**（不是 nice-to-have，多数公司是合规要求）；performance 没显式标注 hot path / high-traffic 作为优先级放大因素。
- **测试 review 盲区：** 当前测试质量是 correctness reviewer 的副 lens，仅在 diff 含测试文件时触发。结果是「PR 加了新逻辑但没加测试」这种常见漏洞**没有任何 reviewer 在看**。需要把 test-quality 提升为独立 reviewer，同时覆盖「测试存在但有问题」和「应该有但没有」两个场景。
- **元插件 review 盲区：** 这个仓库本身是 plugin marketplace，每个 PR 大概率改 plugin / skill / agent 文件，但当前没有任何 reviewer 看 plugin schema、skill 描述触发性、版本同步、AGENTS.md/CLAUDE.md 一致性、Codex 兼容这些专属问题。需要新增 `plugin-quality` reviewer（detection-driven conditional），合并 Anthropic `skill-reviewer` 与 `plugin-validator` 两份职责，并把 Codex 框架兼容作为**核心要求**而非附加项。
- **要规避的风险：** 详细清单容易变成「围栏」（reviewer 只检查列出来的项，列表外的就漏掉）。通过在每个 reference 文件开头加「Scope: starting point, not a fence」前言 + 现有的 coverage-first 框架双重缓解。

## 改动范围

1. **插件打包。** 新建 `plugins/deep-review/`，包含 `.claude-plugin/plugin.json`（v0.1.0）；skill 移到 `plugins/deep-review/skills/deep-review/`；在根目录 `.claude-plugin/marketplace.json` 加条目。
2. **SKILL.md 瘦身到 ≤90 行。** 保留：触发条件、tag 决策矩阵、调度规则、合成规则、anti-patterns。移除：每个 reviewer 的具体职责表和输出契约（迁移到 reference）。
3. **每个 reviewer 一个 reference 文件。** 新建 `references/reviewers/<name>.md`，覆盖：`spec-conformance`、`correctness`、`test-quality`、`docs-sync`、`robustness`、`security`、`ux`、`performance`、`structure`、`code-quality`、`plugin-quality`（共 11 个）。每个文件按以下结构：
   - (a) **Scope 前言**（starting point, not a fence）
   - (b) **Metadata 块**：`Best for` / `Model` / `Effort` / `Tools (read-only)` / `Value`，供主编排器构造 Agent 调用时读取
   - (c) **检查清单**
   - (d) **When to invoke**：以「Recommend When | Detection」二列表为主（≥3 行可检测信号，如文件路径模式 / 关键 import / 关键 API 调用），辅以 ≥3 条 worked scenarios
   - (e) **输出契约**（per-reviewer 报告格式）
4. **测试 review 拆分。** 把测试质量从 correctness 副 lens 提升为独立 `test-quality` reviewer，作为 **non-trivial 条件触发**（与 code-quality 同档）。同时**删除 correctness 的 test-quality 副 lens**，让它纯看生产代码。test-quality 同时覆盖两种场景：(i) 测试文件存在 → 质量 review（behavior vs mocks、mock 粒度、flaky 风险、边界覆盖、是否测的是契约而非实现）；(ii) 新增/修改的生产逻辑分支无对应测试 → 列出缺失的覆盖点。
4b. **新增 dispatch 第 4 类：detection-driven conditional**（仅当 Detection 信号在 diff 中匹配时触发，不绑定 tag、不属于 required / non-trivial）。本次仅一个使用者：`plugin-quality`。SKILL.md 调度矩阵显式列出这一类别，文档化触发逻辑。
5. **清单强化**（不照抄过滤规则）：
   - `robustness.md` ← silent-failure-hunter 的 5 个子问题（Logging Quality / User Feedback / Catch Specificity / Fallback Behavior / Error Propagation）。
   - `docs-sync.md` ← comment-analyzer 的事实校验三轴（签名 ↔ 文档、描述行为 ↔ 代码逻辑、提到的边界情况 ↔ 实际处理）。
   - `structure.md` ← type-design-analyzer 的 4 个轴（封装 / 不变式表达 / 不变式有用性 / 不变式强制），以**清单**形式嵌入，**不**采用 1-10 数字评分。
   - `code-quality.md` 的可维护性子清单 ← code-simplifier 的 anti-patterns（嵌套三元、冗余抽象、过密一行式、复述代码的注释）。
   - `ux.md` 在现有「dead ends / no feedback / misclick / invisible state」基础上，按 surface 分子段补两块当前缺失的维度：(i) **Accessibility** — web：ARIA / 键盘导航 / 读屏兼容 / 色对比度 / 焦点管理；mobile：VoiceOver / TalkBack / Dynamic Type；CLI / TUI：色盲友好色彩 / 终端读屏兼容；(ii) **Responsive design** — 断点 / 多视口稳健性（仅 web 与 mobile 适用）。**Detection 表必须显式列出 mobile 信号**，覆盖：iOS 原生（`.swift` / `.m` / `.mm` / `UIKit` / `SwiftUI` / `Info.plist` / `*.xcodeproj`）、Android 原生（`.kt` / `import android.` / `AndroidManifest.xml` / `@Composable`）、跨平台（React Native：`react-native` import / `metro.config.js`；Flutter：`.dart` / `pubspec.yaml`；Lynx：`@lynx/` import），以及 web（`.tsx` / `.jsx` / `components/` / React・Vue・Angular import）和 CLI / TUI（argparse / commander / clap / inquirer / chalk 等）。
   - `performance.md` 在 Backend/CLI/Data 段补：(i) **hot path / high-traffic 入口**作为优先级放大系数（同等开销在被高频调用时优先级升级）；(ii) 长进程内存泄漏的常见来源补全（除 listener 外，包括未释放的 worker / connection / 无淘汰策略的缓存）。
   - `plugin-quality.md`（新建）合并 Anthropic `skill-reviewer` 与 `plugin-validator`，按 **detection-then-apply** 策略兼容 Claude Code 与 Codex 两套框架。**共享核心**（对两套都适用）：skill 描述触发性（trigger phrases / 第三人称 / 长度）、lean SKILL.md（≤3000 词）、progressive disclosure（references/ examples/ scripts/）、imperative/infinitive 写作风格、命名 kebab-case、无硬编码密钥、AGENTS.md ↔ CLAUDE.md 一致性。**Claude 特有**：`.claude-plugin/plugin.json` schema、agents/*.md frontmatter（含 model/color/tools）、hooks.json（事件名 / matcher / `${CLAUDE_PLUGIN_ROOT}` 用法）、版本同步（plugin.json 与 marketplace.json 同版本）、MCP 走 HTTPS/WSS。**Codex 特有**：Codex 配置文件结构、`codex:` 命名空间识别。**关键兼容规则**：缺失 `.claude-plugin/` **不**自动 fail（先判断框架归属）；双框架插件需双向一致。
6. **合成输出新增 `Strengths` 区段（≤2 条）**，避免 review 报告全是负面信号。
7. **不增加新 tag。** 不新建独立的 simplify 阶段（并入 code-quality 可维护性）；不新增 `types` tag（并入 `structure`）；现有 tag 集合不变（test-quality 由 non-trivial 条件触发，不需要新 tag）。

## 非目标

- 不把 reviewer 暴露为独立可触发的 agent（推迟到有具体需求时再做；当前编排器够用）。
- 不改 tag 分类（`logic` / `auth-sensitive` / `ui` / `perf` / `structure`）。
- 不改 confidence 表达（保持 `high` / `medium` / `low`，与全局工作流一致；不引入 1-10 / 0-100 数字）。
- 不采用「only report ≥80 confidence」式的过滤指令 — 在 Opus 4.7 上是明确的 anti-pattern。
- 不与 `test-designer` skill 重叠：`test-designer` 是 **TDD 红阶段**（实现前设计失败测试，用 Independent Evaluation 防止 self-test 偏差）；deep-review 的 `test-quality` 是 **post-hoc**（review 已写好的测试 + 标记缺失覆盖）。两者在 SKILL.md follow-up 段落点名区分，不互相调用。

## 验收标准

- [ ] AC1：`plugins/deep-review/.claude-plugin/plugin.json` 存在且 `version: 0.1.0`；`marketplace.json` 含同版本条目。
- [ ] AC2：`plugins/deep-review/skills/deep-review/SKILL.md` ≤ 90 行；旧 `skills/deep-review/` 已删除。
- [ ] AC3：11 个 reviewer reference 文件全部存在于 `plugins/deep-review/skills/deep-review/references/reviewers/`（含新增 `test-quality.md` 与 `plugin-quality.md`）。每个文件包含：Scope 前言里**逐字含有**「starting point, not a fence」、清单段落、≥3 条 worked scenarios、输出契约段落。
- [ ] AC4：`robustness.md` 清单显式覆盖 5 个 silent-failure 子问题；`docs-sync.md` 覆盖 3 个事实校验轴；`structure.md` 覆盖 4 个 type-design 轴（散文形式，非数字评分）；`code-quality.md` 可维护性段落点名 ≥3 条 simplifier anti-patterns；`test-quality.md` 显式分两段处理「测试存在」（behavior vs mocks / mock 粒度 / flaky / 边界）和「测试缺失」（列出无覆盖的新增分支）两种场景。
- [ ] AC4b：`correctness.md` 不含测试质量子清单（grep 「test quality」「mock」「flaky」在该文件命中为零，避免与 test-quality 重叠）。
- [ ] AC4c：`ux.md` 含 `Accessibility` 与 `Responsive design` 两个独立子段；Accessibility 段按 surface 分类（web / mobile / CLI 或 TUI），每类至少 2 条具体检查项。
- [ ] AC4d：`performance.md` Backend/CLI/Data 段显式提到 hot path / high-traffic 作为优先级放大因素；长进程内存段列出 ≥3 类常见泄漏来源（如未释放 listener / worker / connection / 无淘汰缓存）。
- [ ] AC4e：`ux.md` Detection 表覆盖全部 5 类 surface：web、iOS 原生、Android 原生、跨平台移动（React Native / Flutter / Lynx 至少各 1 条信号）、CLI / TUI。每类至少 1 行可 grep 的具体信号（路径模式或 import 模式）。
- [ ] AC5：SKILL.md 合成段落含 `Strengths` 子区，并显式带 `(≤2 bullets)` 约束。
- [ ] AC6：SKILL.md 保留所有现有 anti-patterns（不回退「过滤指令告警」「维度合并理由」「Draft PR 不做正式 review」三条）。
- [ ] AC7：在新文件上 `grep -R "confidence.*≥.*80\|filter aggressively\|only report high"` 命中为零 — 确认没漏抄 pr-review-toolkit 的过滤式语言。
- [ ] AC8：分支上仓库 lint / hooks 通过（相对 main 基线无新失败）。
- [ ] AC9：每个 reviewer reference 文件均含 Metadata 块（带 `Best for` / `Model` / `Effort` / `Tools` / `Value` 五字段）和 Detection 表（≥3 行可机械检测的信号，如路径模式 / import 模式 / 关键调用模式）。Tools 字段统一为 read-only 工具集（不含 Write / Edit / Bash 写操作）。
- [ ] AC10：SKILL.md 调度矩阵显式列出 `test-quality` 的触发条件为「non-trivial」（与 code-quality 同档），并在 anti-patterns 中追加一条：**不要把 test-quality 和 correctness 合并为一个 reviewer** — 拆分的目的是让「应该有但没有的测试」这种盲区被看到，合并就丢失了。
- [ ] AC11：SKILL.md 调度矩阵新增「detection-driven conditional」类别，并显式标注 `plugin-quality` 属于此类，触发条件为「diff 命中插件/skill/agent 文件路径模式」。`plugin-quality.md` Detection 表覆盖 4 类信号：(a) Claude 插件结构（`.claude-plugin/`、`plugins/*/`）；(b) skill（`**/SKILL.md`）；(c) agent（`agents/*.md` + frontmatter）；(d) Codex 入口（`AGENTS.md`、`codex:` 命名空间引用）。
- [ ] AC12：`plugin-quality.md` 显式分「共享核心 / Claude 特有 / Codex 特有」三段清单；含一条 anti-pattern：**不要因为缺失 `.claude-plugin/` 就 fail Codex-only 插件** — 先做框架检测再应用对应标准。
- [ ] AC13：`plugin-quality.md` 含一条版本同步检查（plugin.json 与 marketplace.json 同版本）和一条跨框架一致性检查（AGENTS.md 与 CLAUDE.md 应一致或为符号链接），匹配仓库 CLAUDE.md 现有约定。

## 验证计划

- 静态校验：SKILL.md 行数；每个 reference 文件含必需字符串；marketplace.json schema 完整性。
- Dry-run：在承载本次改动的 PR 上触发 `/deep-review`，确认调度逻辑仍按 tag 选对 reviewer 集合、reviewer 能正确加载对应 reference 文件、合成输出包含 Strengths；额外用一个故意「加生产逻辑但不写测试」的 fixture diff 验证 test-quality reviewer 能稳定标出缺失覆盖（验证拆分的核心价值）。
- 没有代码逻辑可测 — 这是纯文档重构；基线就是「skill 在真实 PR 上端到端仍能跑通」。

## 风险与缓解

- **Reviewer 围栏风险：** 通过 Scope 前言 + coverage-first 框架双重缓解（两者都是必需的，分别在 AC3 和 AC6 中被检验）。
- **插件路径变动：** 引用过旧 `skills/deep-review/` 路径的用户会失效。可接受 — skill 原本就不在 marketplace 中，没有「装好的安装路径」会被破坏。需在 PR body 中说明。
