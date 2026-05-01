---
name: gemini-agent
description: 通过 Gemini CLI 将编码、审查、诊断、规划和结构化输出任务委派给独立的 Gemini 会话。使用场景包括 `gemini -p` 非交互执行、`gemini -r latest` 续接最近会话、`gemini -r "<session-id>"` 指定会话恢复，以及需要 `--output-format json` / `stream-json`、`--approval-mode plan` 只读审查、`--sandbox` 隔离执行，或 `--worktree` 在独立 git worktree 中跑任务的 scripted / CI 调用。
---

# Gemini Agent

通过 Gemini CLI 将任务委派给独立的 Gemini 会话执行。

Gemini CLI 的默认入口是 `gemini`（交互式 REPL）。自动化调用走 headless 模式，它在两种情况下会触发：

- 运行在 **non-TTY** 环境（例如 CI、管道 stdin、`run_in_background`）
- 显式传 `-p` / `--prompt`

headless 下 Gemini 不会进交互提示，把最终结果打印到 stdout。想拿可解析输出再叠加 `--output-format json` 或 `stream-json`。

## 前置条件

1. 安装 Gemini CLI 并完成认证（首次运行 `gemini` 会引导登录）
2. 建议在目标项目目录下运行；Gemini 会把当前工作目录作为 workspace 根
3. 需要跨目录访问时，用 `--include-directories` 显式追加

## 调用方式

### 新建会话（默认）

```bash
gemini -p "你的任务描述" --output-format json --approval-mode auto_edit --model pro
```

- `-p, --prompt` 强制非交互模式；自动化调用必备
- `--output-format json` 让 stdout 变成可解析的单对象结果
- 默认 `--approval-mode=default` 会在写操作前确认；编码任务改成 `auto_edit`，无监督脚本才用 `yolo`
- `--model` 建议显式传：`auto`（默认）/ `pro` / `flash` / `flash-lite`

**`--output-format json` 的返回 schema**（官方 headless reference + 实测）：

```json
{
  "session_id": "ca7b5fa6-...",
  "response": "模型的最终回答文本",
  "stats": {
    "models": { "<model-id>": { "api": {"...": "..."}, "tokens": {"...": "..."}, "roles": {"main": {"...": "..."}, "subagent": {"...": "..."}} } },
    "tools": { "totalCalls": 0, "totalSuccess": 0, "totalFail": 0, "byName": {"...": "..."} },
    "files": { "totalLinesAdded": 0, "totalLinesRemoved": 0 }
  },
  "error": { "...": "可选；请求失败时才有" }
}
```

- 自动化里取 `response` 作为最终答案
- `session_id` 顶层就有，要做续接时直接保存这个值喂给 `-r`，不用自己从事件流里拎
- `stats.models` 按实际使用的 model ID 分组；`pro` 在内部会派生 `flash` 级 `subagent` 分担工具调用，所以这里经常看到多个 model
- 如果出现 `error` 字段，配合非 0 的退出码一起当失败处理

### 事件流输出（`stream-json`）

```bash
gemini -p "你的任务描述" --output-format stream-json --model pro
```

`stream-json` 输出 newline-delimited JSON（JSONL），每行一个事件。官方定义的事件类型：

| `type` | 含义 |
|--------|------|
| `init` | 会话元数据，含 session ID 和使用的 model |
| `message` | 用户 / assistant 的消息片段 |
| `tool_use` | 工具调用请求及参数 |
| `tool_result` | 工具执行结果 |
| `error` | 非致命 warning 或系统错误 |
| `result` | 最终结果事件，聚合 stats 和各 model 的 token 用量 |

- 自动化脚本**以 `result` 事件为终态**，从里面拿最终输出和聚合指标
- `message` 只适合做实时展示；不要把中途片段当成最终答案
- `error` 是 non-fatal 的 warning；真正的失败用退出码判断
- 需要调试更多内部细节时再追加 `--debug`

### 继续指定会话

```bash
gemini -p "后续提问" -r "<session-id>" --output-format json --model flash
gemini -p "后续提问" --resume 5 --output-format json --model flash
```

- 脚本里需要确定绑定某次会话时，保存并复用 session ID 或索引号，比 `latest` 更稳
- 当前目录下不同任务的 session 互不干扰

### 继续最近会话（快捷方式）

```bash
gemini -p "后续提问" -r latest --output-format json --model flash
```

- 自动化调用把 prompt 放 `-p`；**不要**用 `gemini -r latest "prompt"` 这种纯位置参数形式——TTY 环境下位置参数默认进交互模式（`gemini --help`: `query ... Runs in interactive mode by default; use -p/--prompt for non-interactive.`），脚本会挂住等输入
- `-r, --resume` 接 `latest`、session 索引号（见下面的 `--list-sessions`）或完整 session ID
- 只提供 `-r latest` 而不带 `-p`，进入最近一次会话的交互模式

### 列出 / 删除本地会话

```bash
gemini --list-sessions
gemini --delete-session 3
```

- 脚本里要挑选历史会话时用 `--list-sessions` 拿到索引号和 session ID
- `--delete-session` 按索引号删除；运行前先 `--list-sessions` 对应清楚，避免误删

### 管道输入 / stdin

两种写法，选一种：

```bash
# A. stdin 当上下文，-p 给明确指令（追加到 stdin 内容之后）
cat logs.txt | gemini -p "Explain the failure in these logs" --output-format json --model flash

# B. stdin 就是 prompt 本体，不传 -p；non-TTY 管道会自动进入 headless
cat ./prompt.md | gemini --output-format json --model pro
```

- **`-p` 必须带字符串参数**；裸写 `-p` 会报 `Not enough arguments following: p`，解析器会吞掉紧跟的下一个 flag 当作 prompt 值
- 想“完全由 stdin 驱动 prompt”时，**不要传 `-p`**，直接走 pattern B。管道本身是 non-TTY，CLI 会自动进入 headless
- pattern A 适合“上下文走 stdin，指令走 `-p`”的组合；pattern B 适合已经把完整 prompt 拼进 stdin 的场景

### Interactive 追加一句（`-i`）

```bash
gemini -i "先帮我看下这个项目的结构"
```

- `-i, --prompt-interactive` 会**先执行一次 prompt**，然后**留在交互式 REPL**
- 适合“问一句再接着手动对话”的场景；不要在脚本或 CI 里用它

## gemini CLI 参数

### 输出与结果

| Flag | 说明 |
|------|------|
| `-p, --prompt TEXT` | 非交互模式；`json` / `stream-json` 输出都依赖它 |
| `-i, --prompt-interactive TEXT` | 执行一次 prompt 后继续进入交互式 REPL |
| `-o, --output-format FORMAT` | `text`（默认）/ `json` / `stream-json` |
| `-d, --debug` | 打开调试模式；会输出更详细的日志到 stderr |

### 会话管理

| Flag | 说明 |
|------|------|
| `-r, --resume TARGET` | 恢复会话：`latest` / 索引号（如 `5`）/ 完整 session ID |
| `--list-sessions` | 列出当前项目可恢复的会话并退出 |
| `--delete-session INDEX` | 按索引号删除会话 |

### 权限与工具边界

| Flag | 说明 |
|------|------|
| `--approval-mode MODE` | `default` / `auto_edit` / `yolo` / `plan` |
| `-y, --yolo` | **已废弃**；等价于 `--approval-mode=yolo` |
| `-s, --sandbox` | 在沙箱环境里执行，增加一层隔离 |
| `--allowed-mcp-server-names LIST` | 允许哪些 MCP server（多值用逗号或重复传） |
| `--policy FILES` | Policy Engine 策略文件/目录（可多传），细化工具白名单 |
| `--admin-policy FILES` | 管理员级 policy，优先级更高 |
| `--allowed-tools LIST` | **已废弃**；改用 `--policy` / Policy Engine |

`--approval-mode` 的分档：

- `default`：写操作前二次确认，适合交互；**脚本不要用**，否则会卡在确认提示
- `auto_edit`：自动放行文件编辑，其它敏感动作仍需确认，适合大多数编码任务
- `yolo`：自动放行全部动作；只在完全可信的自动化里使用
- `plan`：只读规划模式，不执行写动作，最适合代码审查 / 诊断 / recon

### 模型与上下文

| Flag | 说明 |
|------|------|
| `-m, --model MODEL` | `auto`（默认）/ `pro` / `flash` / `flash-lite`，也可直接传模型全名 |
| `--include-directories DIRS` | 额外加入 workspace 的目录（逗号分隔或重复） |
| `--screen-reader` | 屏幕阅读器可访问性模式 |

模型 alias 说明：

- `auto`（默认）：跟着 preview 开关和 CLI 版本解析，实际 ID 可能是 `gemini-2.5-pro` / `gemini-3-pro-preview` / `gemini-3.1-pro-preview` 之类的 preview 版本；自动化里**不要依赖具体 model ID**
- `pro`：复杂推理 / 多文件编码的主脑；CLI 还会在内部派出 `flash` 级别的 subagent 分担工具调用（`stats.models.*.roles` 里能看到 `main` / `subagent` 两个角色）
- `flash`：快速均衡
- `flash-lite`：最快、最轻量
- 这几个 alias 的**具体 model ID 会随 CLI 版本漂移**；只要认 alias，不要把 `gemini-2.5-*` 这种字面量写进脚本断言

### 运行环境

| Flag | 说明 |
|------|------|
| `-w, --worktree [NAME]` | 在独立 git worktree 里启动；**实验特性**，需要 settings 打开 `experimental.worktrees: true` |
| `-e, --extensions NAMES` | 只加载指定的 Gemini extensions |
| `-l, --list-extensions` | 列出所有 extensions 并退出 |
| `--acp` | 以 ACP（Agent Code Pilot）模式启动 |
| `--experimental-acp` | **已废弃**；使用 `--acp` 代替 |

## 退出码

Headless 模式下 Gemini 返回标准退出码，脚本可以直接按它判成败：

| 退出码 | 含义 |
|--------|------|
| `0` | 成功 |
| `1` | 通用错误或 API 失败 |
| `42` | 输入错误（无效 prompt 或参数） |
| `53` | 超过 turn 上限 |

推荐脚本同时看两个信号：

- 退出码为 `0` 且 json 里无 `error` 字段 → 成功
- 非 `0` 退出码 → 按上表分类处理（尤其 `42` 是自己的 prompt / flag 组合有问题，`53` 说明任务跑太深，需要拆细或加重试）

## 子命令

Gemini CLI 除了主命令外，还有若干管理子命令：

| 子命令 | 说明 |
|--------|------|
| `gemini update` | 升级到最新版本 |
| `gemini extensions <...>` | 管理 extensions：`install` / `uninstall` / `list` / `enable` / `disable` / `link` / `update` |
| `gemini mcp <...>` | 管理 MCP servers：`add` / `remove` / `list`，支持 stdio 和 http |
| `gemini skills <...>` | 管理 agent skills：`install` / `link` / `enable` / `disable` / `list` |
| `gemini hooks <...>` | 管理 Gemini CLI hooks |

这些子命令一般**不在委派流程里用**，属于环境配置。遇到缺失的 extension 或 MCP server 时，提醒用户先用对应子命令安装。

## 多轮对话

1. 首次 `gemini -p "..." --output-format json ...` 获取结果；若后续要追问，记录 session ID 或索引
2. 追问用 `gemini -p "..." -r <session-id>`，或同目录下用 `-p "..." -r latest`
3. 不同任务各自新建会话；多个 session 互不干扰
4. 要定位已有会话，先 `gemini --list-sessions` 查索引和 ID

## 模型与 approval-mode 选择

根据任务复杂度显式指定 `--model`；根据风险面选 `--approval-mode`：

| 任务复杂度 | model | 适用场景 |
|-----------|-------|---------|
| 高 | `pro` | 架构设计、复杂重构、多文件编码 |
| 中 | `flash` | 单文件功能实现、bug 修复、一般分析 |
| 低 | `flash-lite` | 简单问答、代码解释、快速续问 |

| 风险面 | approval-mode | 适用场景 |
|--------|---------------|---------|
| 高（不可回滚 / 多步写动作） | `default` 交互 | 脚本里别用，会卡在确认 |
| 中（标准编码任务） | `auto_edit` | 文件编辑放行，其它敏感动作仍要确认 |
| 低（沙箱 / 完全受控） | `yolo` | 全放行，只在隔离环境或完全可信任务里用 |
| 只读 | `plan` | 代码审查、诊断、recon、测试缺口检查 |

## 推荐参数组合

| 场景 | model | approval-mode | 其他 flags |
|------|-------|---------------|-----------|
| 复杂编码 | `pro` | `auto_edit` | `--output-format json` |
| 一般编码 | `flash` | `auto_edit` | `--output-format json` |
| 只读问答 / 分析 | `flash` | `plan` | `--output-format json` |
| 代码审查 | `flash` | `plan` | `--output-format json` |
| 挑战式审查 | `pro` | `plan` | `--output-format json` |
| 快速问答 | `flash-lite` | `default` | `--output-format json` |
| 工具链消费事件流 | `flash` 或 `pro` | 视任务而定 | `--output-format stream-json` |
| 隔离执行 | `pro` | `auto_edit` | `--worktree feature-x`（实验特性） |
| 沙箱里放得更开 | `flash` 或 `pro` | `yolo` | `--sandbox` |

## 使用规则

1. **自动化调用默认用 `-p` + `--output-format json`**：拿稳定可解析的单对象结果；只有确实需要事件流时再切 `stream-json`
2. **始终显式传 `--model`**：默认 `auto` 会跟着 preview flag 漂移，自动化里要指定 `pro` / `flash` / `flash-lite`
3. **始终显式传 `--approval-mode`**：默认 `default` 会卡在交互确认；脚本至少要 `auto_edit`，只读任务用 `plan`
4. **不要用 `--yolo` 这个旧 flag**：等价物是 `--approval-mode=yolo`，后者语义更清晰
5. **不要用 `--allowed-tools`**：官方已废弃，改走 Policy Engine 配置
6. **始终在目标项目目录运行**：先 `cd /path/to/project`，需要跨目录再用 `--include-directories`
7. **编码任务默认 `auto_edit`，审查任务默认 `plan`**：写动作尽量和风险面匹配，而不是一把 `yolo`
8. **保持对话连续**：追问时用 `-p "..." -r latest` 或 `-p "..." -r <session-id>`；不要每轮都重新开 session
9. **`-r latest` 适合“继续刚才那个任务”**；脚本跨目录或长时间跑，绑定 session ID 更稳
10. **向用户报告结果时优先取 `response` 字段**：`--output-format json` 下最终答案在 `response`；`stream-json` 下以最后一条 `type == "result"` 事件为终态，不要把中途 `message` 片段当成终态
11. **靠退出码判成败，不光看 stdout**：`0` 成功 / `1` 通用错误或 API 失败 / `42` 输入错误（prompt 或 flag 有问题） / `53` 超过 turn 上限；`error` 事件是 non-fatal warning，别和退出码混用
12. **大风险动作叠加 `--sandbox`**：`yolo` 放全权限时，至少要配沙箱做兜底
13. **`--worktree` 是实验特性**：需要先在 settings 打开 `experimental.worktrees: true`；不确定是否开启时，用普通 git worktree + `cd` 更稳
14. **`-p` 模式里不要依赖交互式 slash commands**：`/skills reload` 这类只在 REPL 里生效；自动化用自然语言描述任务即可
15. **长 prompt 走 stdin 有两种正确写法**：`cat prompt.md | gemini --output-format json --model pro`（纯 stdin 驱动，不传 `-p`）或 `cat ctx.md | gemini -p "指令" --output-format json --model pro`（stdin 当上下文，`-p` 给指令）。**不要裸写 `-p`**，会报 `Not enough arguments following: p`
16. **不要用位置参数传 prompt 给自动化**：`gemini "..."` 或 `gemini -r latest "..."` 在 TTY 下默认进交互模式；脚本要么用 `-p`，要么靠 non-TTY 管道触发 headless

## Prompt References

按任务类型按需加载对应 reference，不要把所有默认 prompt 一次性塞进主上下文：

- **编码 / 诊断 / 规划 / 窄修复**：读 [references/task-prompt-recipes.md](references/task-prompt-recipes.md)
- **代码审查 / 挑战式审查 / 测试缺口检查**：读 [references/review-prompt-recipes.md](references/review-prompt-recipes.md)
- **委派 handoff / 独立 worker / 续接同一 session**：读 [references/delegation-prompt-recipes.md](references/delegation-prompt-recipes.md)

这些 reference 提供的是可直接复用或轻改的默认 prompt 模板；优先复制最接近的模板，再删掉不需要的块。

## 示例

### 编码任务

```bash
cd /path/to/project && gemini -p \
  "Implement a REST API for TODO items with CRUD endpoints. Use Express.js." \
  --output-format json \
  --approval-mode auto_edit \
  --model pro
```

适合一次委派一整段实现；结果通过 stdout 的 JSON 对象返回。

### 继续最近会话

```bash
cd /path/to/project && gemini -p \
  "Continue from the current state. Add unit tests for the new endpoints and report only the final outcome." \
  -r latest \
  --output-format json \
  --approval-mode auto_edit \
  --model flash
```

适合“刚才那个任务继续做”，不想手动保存 session ID 的场景。

### 指定 session 继续

```bash
# 先列出现有会话拿到索引 / ID
gemini --list-sessions

# 再按 ID 续接
cd /path/to/project && gemini -p \
  "Pick up where we left off and finish the remaining test coverage." \
  -r "019d32fc-..." \
  --output-format json \
  --approval-mode auto_edit \
  --model flash
```

适合脚本需要明确绑定某次会话，或在多个 session 并存时避免 `latest` 歧义。

### 代码审查

```bash
cd /path/to/project && gemini -p \
  "Review git diff HEAD~1. Focus on correctness, regression risk, and missing tests. Findings first." \
  --output-format json \
  --approval-mode plan \
  --model flash
```

`plan` 模式下 Gemini 不会执行写动作，适合 PR 审查 / 诊断 / recon。

### 事件流输出给上层工具

```bash
cd /path/to/project && gemini -p \
  "Review the current diff and stream progress plus a final verdict." \
  --output-format stream-json \
  --approval-mode plan \
  --model flash
```

适合上层 agent 或脚本按 JSONL 消费中间事件，最后一条结果事件作为终态答案。

### 管道输入长 prompt

```bash
# 1. 把复杂 prompt 写进文件
cat > /tmp/task-prompt.md <<'PROMPT_EOF'
请在当前仓库完成以下任务：
1. 先阅读 README 和 tests
2. 只修改与 issue 直接相关的文件
3. 先补测试，再改实现，最后运行验证
PROMPT_EOF

# 2. 从 stdin 喂给 Gemini；不传 -p，让 non-TTY 管道自动进入 headless
cat /tmp/task-prompt.md | gemini \
  --output-format json \
  --approval-mode auto_edit \
  --model pro
```

适合多段 Markdown 约束、脚本拼装 prompt，或任何已经超过一屏的任务描述。注意**不要裸写 `-p`**——`-p` 必须跟字符串；想完全让 stdin 当 prompt 就直接省略 `-p`。

### 管道输入日志

```bash
cat logs.txt | gemini -p \
  "Explain the failure in these logs. Return root cause, evidence, and the smallest safe next step." \
  --output-format json \
  --approval-mode plan \
  --model flash
```

`-p` 的 prompt 文本会追加到 stdin 末尾，适合“上下文走 stdin、指令走 `-p`”的组合。

### 隔离 worktree 执行（实验特性）

```bash
cd /path/to/project && gemini -p \
  "Implement the fix in an isolated worktree, run the most relevant tests, and summarize the final result." \
  --output-format json \
  --approval-mode auto_edit \
  --model pro \
  --worktree fix-login-timeout
```

先确认 settings 里 `experimental.worktrees: true` 已打开；否则这个 flag 会报错。

### 沙箱里放开权限

```bash
cd /path/to/project && gemini -p \
  "Apply and verify the upgrade plan end-to-end." \
  --output-format json \
  --approval-mode yolo \
  --sandbox \
  --model pro
```

`yolo` 放全权限时，至少配 `--sandbox` 兜底，避免 Gemini 对宿主环境做不可回滚的写动作。
