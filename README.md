# dsh-anchored-standard-windows

Community Agent preset for Windows DeepSeek Harness. This repository is a
**preset package**, not a Cordis runtime plugin: it has no `dsh.bundle` entry and
will not appear as a second item in DSH's runtime-plugin inventory.

Use it together with
[`dsh-subprocess-win32`](https://github.com/delightedMaster/dsh-subprocess-win32),
which supplies the Windows `subprocess-win32` runtime and the Git Bash/editor
surface used by the preset.

## Relationship with `dsh-subprocess-win32`

These repositories deliberately have different layers:

| Repository | Layer | Owns | Installation consequence |
| --- | --- | --- | --- |
| [`dsh-subprocess-win32`](https://github.com/delightedMaster/dsh-subprocess-win32) | DSH Cordis runtime plugin | The `subprocess-win32` inventory entry, Windows process adapter, lifecycle manager, and managed copies of both Windows presets | Install this first on Windows; its manager also installs, updates, rolls back, and removes the presets |
| `dsh-anchored-standard-windows` (this repository) | User Agent preset package | `agent.cordis.yml`, the phase-gating modules, and preset tests | Optional when the managed bundle is used; required only when distributing or testing Anchored independently |

The runtime plugin does not require Anchored Standard: Minimal, official Standard,
or no custom preset can be used with it. The preset package cannot replace the
runtime plugin, and it is not expected to appear as a second row in DSH's plugin
inventory. When the first repository's lifecycle manager is used, the two source
trees are kept as one managed installation so a later update or complete uninstall
can account for both.

## Why this preset exists

The official Standard preset exposes a large tool catalog and automatic Skill and
workspace-context injections from the first request. That is useful for breadth,
but it changes the model-visible context before a task starts. This preset keeps a
small, Minimal-aligned first request while retaining a path to Standard tools:

1. **Bootstrap:** exactly `bash` and `str_replace_editor`; no automatic Skill
   catalog and no full AGENTS/CLAUDE instruction digest.
2. **Promoted resident set:** the two bootstrap tools plus
   `dev_tool_search`, `skill_search`, and `skill_load`.
3. **On demand:** PowerShell, web, workflow, subagent, planning, and other
   Standard tools appear only after an explicit `dev_tool_search` unlock.

After compaction the session returns to the controlled small set and requires a
new promotion signal. Durable events keep unlocked tools available after resume.

This is a workload-oriented compromise, not a claim that Windows is Linux or that
every task will match Minimal's latency or completion rate.

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
