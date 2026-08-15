# dsh-anchored-standard-windows

> **Progressive-Disclosure Agent Preset for Windows DeepSeek Harness — Zero initial tool bloat, full Standard power on demand.**

`dsh-anchored-standard-windows` is a modular User Agent preset designed for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) on Windows. It eliminates initial context pollution by introducing a multi-tier progressive tool loading mechanism—combining the lightweight speed of `Minimal` with the rich capabilities of `Standard`.

---

## Highlights & The Progressive Solution

- **The Problem with Stock Standard**: The official Standard preset injects full tool schemas, skill registries, and system prompt digests starting from Turn 1. This burns substantial context tokens, introduces latency, and increases model hallucination risk on simple tasks.
- **The Problem with Stock Minimal**: Minimal is fast and clean, but cannot access advanced tools (PowerShell, workflow automation, web fetchers, subagents, or domain skills) when tasks scale in complexity.
- **The Anchored Solution**: Progressive Disclosure. Your model starts lean and fast, discovers tools dynamically via bounded search, and pulls heavy capabilities into context only when needed.

---

## How It Works: 3-Tier Progressive Architecture

```
[ Turn 1: Bootstrap ] ──────────► [ Turn 2+: Resident Core ] ───────► [ On Demand: Dynamic Unlock ]
  • bash                            • bash, str_replace_editor          • PowerShell (pwsh)
  • str_replace_editor              • dev_tool_search                   • Web & Network Tools
  (Zero skill catalog bloat)        • skill_search / skill_load         • Subagents & Workflows
                                                                        • Specific SKILL.md specs
```

1. **Bootstrap Phase (Turn 1)**  
   Only `bash` and `str_replace_editor` are exposed. No automatic skill catalogs and no bulky instruction dumps. Immediate response with minimal token consumption.
2. **Resident Discovery Core (Turn 2+)**  
   Promotes the active set to include lightweight discovery tools: `dev_tool_search`, `skill_search`, and `skill_load`.
3. **On-Demand Dynamic Promotion**  
   When the agent determines it needs specialized tools (e.g. `pwsh`, web tools, or specific domain skills), it queries `dev_tool_search` or `skill_load`. Only the requested schemas are injected into the active scope.
4. **Compaction & Resume Resilient**  
   After session compaction, the context cleanly resets to the lean resident set to prevent permanent bloat, while durable session events preserve unlocked tools across resumes.

---

## Relationship with `dsh-subprocess-win32`

This repository is a **preset specification package**, not a Cordis runtime plugin:

| Repository | Role in DSH | What It Provides | Installation Guide |
| :--- | :--- | :--- | :--- |
| [`dsh-subprocess-win32`](https://github.com/delightedMaster/dsh-subprocess-win32) | **Cordis Runtime Plugin** | `subprocess-win32` runtime, process adapter, and lifecycle installer for both presets | **Install this first on Windows.** Its manager configures, installs, and updates presets automatically. |
| **`dsh-anchored-standard-windows`** *(This repo)* | **Agent Preset Package** | `agent.cordis.yml`, phase-gating modules, and preset unit tests | **Optional.** Needed only when inspecting, customizing, or testing Anchored independently. |

---

## Installation

### Managed DSH installation (recommended)

Install `dsh-subprocess-win32` first. Its lifecycle manager copies and renders this
preset into the DSH user preset directory, substitutes the actual Git Bash path,
and configures the shared Skill roots:

```powershell
$setup = "$env:LOCALAPPDATA\DeepSeekHarness\setup\dsh-subprocess-win32.ps1"
& $setup -Action setup -PackageSource C:\src\dsh-subprocess-win32
```

Start a new empty session and choose `Anchored Standard (Windows)`. Do not switch
the Agent preset in an existing session; the composition is fixed at session
creation.

### Standalone preset copy

If you already have the Windows runtime and want to copy only this preset, copy
`preset\anchored-standard-windows` to:

```text
%LOCALAPPDATA%\DeepSeekHarness\home\.agent-presets\anchored-standard-windows
```

Before starting DSH, replace these two placeholders in `agent.cordis.yml`:

- `__GIT_BASH__` with the forward-slash form of your Git Bash executable, for
  example `C:/Program Files/Git/bin/bash.exe`.
- `__CODEX_SKILL_DIRS__` with a YAML list of additional read-only Skill roots.
  The DSH default roots still apply; the managed installer adds the user's
  `.codex\skills` directory when it exists.

The standalone copy must be paired with `dsh-subprocess-win32` on Windows. Do not
mount the stock `dsh-tool-skill` catalog row in the same composition, or the
large automatic Skill catalog will return to the first request.

## Skills and MCP

Skills are discovered progressively. `skill_search` returns bounded summaries;
`skill_load` loads one exact `SKILL.md` body for the next request. Project
`.agents\skills` and DSH default roots remain read-only. Codex Skills are not
copied or modified. MCP Tools can be shared only after converting their server
configuration to DSH's MCP client format; Resources and Prompts are not assumed
compatible.

## Tool-search behavior

The discovery implementation resolves schemas in the calling Agent scope. This is
important for tools such as `pwsh`; resolving a process-global catalog can make a
valid Standard tool appear to be missing. The implementation follows the fix
described in [upstream issue #24](https://github.com/xiaobright/dsh-anchored-standard/issues/24).

Example flow:

```text
skill_search("pdf")
skill_load("pdf")
dev_tool_search("PowerShell")
pwsh(...)
```

The names above are illustrative; always use the exact names returned by the
discovery tool.

## Update, rollback, and removal

This repository has no install-time lifecycle script. Update it by checking out a
new commit, running the preset tests, and then re-rendering the preset through the
`dsh-subprocess-win32` manager. Do not overwrite a managed preset by hand: the
manager detects modified files and refuses to destroy them silently.

For the managed installation, preview and execute removal with:

```powershell
& $setup -Action uninstall -DryRun
& $setup -Action uninstall
```

That operation removes the DSH runtime, this preset, backups, and the dedicated
DSH root only. It preserves project files, Codex plugins, Codex Skills, and the
original Codex MCP configuration. Export modified presets first if you need to
keep local changes.

## Limitations

- Experimental community preset; no official DeepSeek endorsement.
- Requires a DSH host whose Agent-plane hooks and event types match the tested
  `0.1.0-rc.6` composition.
- `dsh-subprocess-win32` 0.3.0 can encounter Windows `workspace-write` ACL
  failures (`0xC0000142`) in Git/MSYS Bash. Full-access validation passed, but the
  package never silently bypasses DSH approval or selects `danger-full-access`.
- The Windows fallback shell is not a Linux sandbox. Treat command output as
  untrusted and keep approvals enabled.

## Tests

```powershell
npm test
```

The tests cover bootstrap and promotion tool schemas, suppressed context,
compaction epochs, Skill discovery/loading, and the Windows Bash adapter. They are
not a model-quality benchmark.

## References and acknowledgements

This preset is adapted from the ideas and public tests in:

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), official
  Agent presets, Skills, and Cordis composition.
- [`xiaobright/dsh-anchored-standard`](https://github.com/xiaobright/dsh-anchored-standard)
  at commit `f57a1bde2dbaba3039bdae8631f78a0cb3ae3ebe` (MIT), the original
  community two-phase preset.
- [`sjh9714/dsh-win32`](https://github.com/sjh9714/dsh-win32) at commit
  `f8a68a9836b84fdfec5c1f36ab60cea9923c689f` (MIT), the Windows subprocess
  direction used by the companion runtime.
- [Issue #24](https://github.com/xiaobright/dsh-anchored-standard/issues/24),
  documenting current-Agent-scope tool schema lookup.

Thanks to the upstream maintainers and community testers for the runtime seams,
trajectory experiments, and regression reports. This repository is an independent
Windows adaptation and is not affiliated with DeepSeek or OpenAI.
