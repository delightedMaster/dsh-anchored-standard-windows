# dsh-anchored-standard-windows

[English](README.md) | 中文

> **Windows DeepSeek Harness 渐进式按需加载 Agent 预设 —— 首轮零上下文污染，按需解锁全量能力。**

`dsh-anchored-standard-windows` 是专为 Windows 平台下的 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 打造的模块化 Agent 预设包。它通过创新的“三阶段渐进式工具加载”机制，完美兼顾了 Minimal 预设的极速省 Token 优势与 Standard 预设的强大工具生态。

---

## 核心设计与渐进式方案

- **官方 Standard 预设的痛点**：第一轮请求就全量注入庞大的工具定义、Skill 目录和系统上下文，消耗大量 Token 预算，增加模型幻觉概率并拖慢首轮响应。
- **官方 Minimal 预设的痛点**：虽然清爽极速，但在面对复杂场景时无法调用 PowerShell、联网工具、子智能体或特定专业 Skill。
- **Anchored Standard 的解决方案**：**渐进式暴露（Progressive Disclosure）**。模型以极简模式快速启动，在后续交互中通过检索按需加载具体工具与技能，将上下文占用降至最低。

---

## 运行机制：三阶段渐进式架构

```
[ 第一阶段：极简启动 ] ──────────► [ 第二阶段：常驻检索核心 ] ───────► [ 第三阶段：按需动态加载 ]
  • bash                            • bash, str_replace_editor          • PowerShell (pwsh)
  • str_replace_editor              • dev_tool_search                   • 联网与检索工具
  (零 Skill 目录注入，极省 Token)    • skill_search / skill_load         • 子智能体与工作流工具
                                                                        • 具体的 SKILL.md 文档
```

1. **第一阶段：极简启动（Bootstrap）**  
   仅暴露 `bash` 与 `str_replace_editor` 两个基础工具。不自动注入全量 Skill 目录和冗长规则摘要，实现超低延迟首轮响应。
2. **第二阶段：常驻检索核心（Resident Core）**  
   升级为常驻工具集，增加轻量级检索能力：`dev_tool_search`、`skill_search` 与 `skill_load`。
3. **第三阶段：按需动态加载（On-Demand Promotion）**  
   当任务需要使用特定能力（如 `pwsh`、网页访问、子 Agent 或特定 Skill）时，通过检索工具按需载入对应的 Schema，绝不提前占用上下文。
4. **上下文压缩与恢复保障（Compaction & Resume）**  
   发生上下文压缩（Compaction）后，会优雅重置回常驻精简集，防止上下文永久膨胀；同时通过持久化事件确保已解锁工具在会话恢复后依然可用。

---

## 与 `dsh-subprocess-win32` 的关系说明

本仓库是 **Agent 预设包**，而非 Cordis 运行时插件：

| 仓库 | DSH 角色 | 包含内容 | 安装指南 |
| :--- | :--- | :--- | :--- |
| [`dsh-subprocess-win32`](https://github.com/delightedMaster/dsh-subprocess-win32) | **Cordis 运行时插件** | `subprocess-win32` 运行时、进程适配器以及两套预设的安装管理器 | **Windows 上应先安装。** 其管理器会自动配置、安装并更新预设。 |
| **`dsh-anchored-standard-windows`** *(当前仓库)* | **Agent 预设包** | `agent.cordis.yml`、阶段门禁模块以及独立的预设单元测试 | **可选。** 仅在需要独立检查、二次开发或测试 Anchored 预设时使用。 |

---

## 安装

### 推荐：使用管理式 DSH 安装

先安装 `dsh-subprocess-win32`。它的生命周期管理器会将本预设复制并渲染到 DSH
用户预设目录，替换实际 Git Bash 路径，并配置共享 Skill 根目录：

```powershell
$setup = "$env:LOCALAPPDATA\DeepSeekHarness\setup\dsh-subprocess-win32.ps1"
& $setup -Action setup -PackageSource C:\src\dsh-subprocess-win32
```

新建一个空会话，选择 `Anchored Standard (Windows)`。不要在已有会话中切换 Agent
预设；预设组合在创建会话时确定。

### 只复制预设

如果已有 Windows 运行时，只想复制本仓库的预设，将
`preset\anchored-standard-windows` 复制到：

```text
%LOCALAPPDATA%\DeepSeekHarness\home\.agent-presets\anchored-standard-windows
```

启动 DSH 前，编辑 `agent.cordis.yml` 替换两个占位符：

- `__GIT_BASH__`：Git Bash 可执行文件的正斜杠路径，例如
  `C:/Program Files/Git/bin/bash.exe`。
- `__CODEX_SKILL_DIRS__`：额外只读 Skill 根目录的 YAML 列表。DSH 默认 Skill
  根仍然生效；管理器在目录存在时会加入用户的 `.codex\skills`。

单独复制时仍必须安装 `dsh-subprocess-win32`。同一组合中不要再挂载官方
`dsh-tool-skill` 目录注入行，否则首轮的大型 Skill 目录会重新出现。

## Skills 和 MCP

Skills 采用渐进发现：`skill_search` 只返回有限摘要，`skill_load` 按精确名称加载
一个 `SKILL.md` 正文供下一轮使用。项目 `.agents\skills` 和 DSH 默认根目录保持只读，
不会复制或修改 Codex Skills。MCP Tools 只有在转换为 DSH MCP 客户端格式后才考虑
共享；Resources 和 Prompts 不默认视为兼容。

## 工具搜索

发现实现会在调用方 Agent scope 中解析工具 schema。这一点对 `pwsh` 等工具很重要；
如果错误地读取进程级目录，合法的 Standard 工具会显示为找不到。本实现采用
[上游 issue #24](https://github.com/xiaobright/dsh-anchored-standard/issues/24)
记录的修复方向。

示例流程：

```text
skill_search("pdf")
skill_load("pdf")
dev_tool_search("PowerShell")
pwsh(...)
```

以上名称仅作示例，实际使用时以发现工具返回的精确名称为准。

## 更新、回退和移除

本仓库没有安装时生命周期脚本。更新时切换到新提交，运行测试，再通过
`dsh-subprocess-win32` 管理器重新渲染预设。不要手工覆盖受管理的预设；管理器会
检测修改并拒绝静默销毁。

管理式安装的删除方式：

```powershell
& $setup -Action uninstall -DryRun
& $setup -Action uninstall
```

该操作只删除 DSH 运行时、本预设、备份和专用 DSH 根目录，保留项目文件、Codex
插件、Codex Skills 和原始 Codex MCP 配置。需要保留本地修改时，先导出修改后的
预设。

## 限制

- 这是实验性社区预设，没有 DeepSeek 官方背书。
- 需要与已测试的 `0.1.0-rc.6` Agent-plane hook 和事件类型相匹配的 DSH Host。
- `dsh-subprocess-win32` 0.3.0 在 Windows `workspace-write` ACL 下可能遇到
  Git/MSYS Bash `0xC0000142`；完整权限验证已通过，但不会绕过 DSH 审批或静默
  选择 `danger-full-access`。
- Windows 回退 Shell 不是 Linux 沙箱，请把命令输出当作不可信数据并保留审批。

## 测试

```powershell
npm test
```

测试覆盖首轮/提升工具 schema、上下文抑制、压缩 epoch、Skill 发现/加载和 Windows
Bash 适配器；不代表模型质量基准。

## 参考项目和致谢

本预设参考并改编自以下公开项目和资料：

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)：官方 Agent
  预设、Skills 和 Cordis 组合。
- [`xiaobright/dsh-anchored-standard`](https://github.com/xiaobright/dsh-anchored-standard)：
  固定提交 `f57a1bde2dbaba3039bdae8631f78a0cb3ae3ebe`（MIT），原始社区两阶段预设。
- [`sjh9714/dsh-win32`](https://github.com/sjh9714/dsh-win32)：固定提交
  `f8a68a9836b84fdfec5c1f36ab60cea9923c689f`（MIT），配套运行时采用的 Windows
  subprocess 方向。
- [Issue #24](https://github.com/xiaobright/dsh-anchored-standard/issues/24)：
  当前 Agent scope 工具 schema 查找问题。

感谢上游维护者和社区测试者公开运行时接口、轨迹实验和回归报告。本仓库是独立的
Windows 适配，不代表 DeepSeek 或 OpenAI 背书。
