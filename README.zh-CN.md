# dsh-anchored-standard-windows

这是 Windows 版 DeepSeek Harness 的社区 Agent 预设包。它是**预设包**，不是
Cordis 运行时插件：没有 `dsh.bundle` 声明，因此不会作为第二个运行时插件出现在
DSH 的插件库存中。

请配合
[`dsh-subprocess-win32`](https://github.com/delightedMaster/dsh-subprocess-win32)
使用，由后者提供 Windows 的 `subprocess-win32` 运行时以及 Git Bash/编辑器工具面。

## 与 `dsh-subprocess-win32` 的关系

两个仓库刻意处在不同层：

| 仓库 | 层级 | 负责内容 | 安装影响 |
| --- | --- | --- | --- |
| [`dsh-subprocess-win32`](https://github.com/delightedMaster/dsh-subprocess-win32) | DSH Cordis 运行时插件 | `subprocess-win32` 插件库存项、Windows 进程适配器、生命周期管理器，以及两个 Windows 预设的受管理副本 | Windows 上应先安装；管理器也负责预设的安装、更新、回退和删除 |
| 本仓库 `dsh-anchored-standard-windows` | 用户 Agent 预设包 | `agent.cordis.yml`、阶段控制模块和预设测试 | 使用管理式 bundle 时可不单独安装；只有独立分发或测试 Anchored 时才需要 |

运行时插件并不要求 Anchored Standard，可以和 Minimal、官方 Standard 或任何自定义预设一起使用。
预设包不能替代运行时插件，也不应该在 DSH 插件库存中显示为第二行。使用前一个仓库的生命周期
管理器时，两套源码作为同一个受管理安装处理，后续更新或完整卸载都能同时登记和清理。

## 解决什么问题

官方 Standard 首轮就会暴露较大的工具目录，并自动注入 Skill 和工作区上下文。这
有利于功能完整，但会在任务开始前改变模型可见上下文。本预设保留 Standard 能力，
同时把常驻表面压到较小范围：

1. **首轮启动：**严格只有 `bash` 和 `str_replace_editor`，不注入 Skill 目录，也
   不注入完整 AGENTS/CLAUDE 指令摘要。
2. **提升后的常驻工具：**两个启动工具，加上 `dev_tool_search`、`skill_search`、
   `skill_load`。
3. **按需解锁：**PowerShell、网页、工作流、子代理、计划等 Standard 工具只有
   在显式执行 `dev_tool_search` 后才进入 schema。

压缩后会回到受控的小工具集合，产生新的有效提升事件后才恢复已解锁能力；持久化
事件保证恢复会话后不会无故丢失解锁状态。

这是针对特定工作负载的折中方案，不声称 Windows 变成 Linux，也不保证所有任务与
Minimal 的延迟或完成率相同。

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
