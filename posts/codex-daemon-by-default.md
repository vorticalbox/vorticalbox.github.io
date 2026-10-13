---
title: The Codex CLI runs a self-updating daemon by default now
date: 2026-10-13
tags: [agents, tools, package-management]
description: Since 0.157.0, opening a Codex session starts a detached, self-updating daemon. The source says it's a Stable default, and package managers can't manage it.
slug: codex-daemon-by-default
---

Somewhere around version 0.157.0, opening an interactive `codex` session stopped being just that. It now starts a daemon: `codex app-server --managed-daemon`, detached, no TTY, reparented to PID 1, still running after every Codex window is closed. The report is [issue #48195](https://github.com/openai/codex/issues/48195), opened 25 September, still open. I went to the source to check whether "by default" was accurate.

It is. In `codex-rs/features/src/lib.rs`, the feature is registered as `DaemonAutoStart`, key `daemon_auto_start`, `stage: Stage::Stable`, `default_enabled: true`. Not an experiment behind a flag you opt into — a shipped default. The workaround people pass around (`[features] daemon_auto_start = false` in `~/.codex/config.toml`) is real, and the config parser does accept it, but the flag it flips is Stable.

## What the daemon actually does

From the `app-server-daemon` README and the issue report:

- Copies the invoking package into `~/.codex/packages/app-server-daemon/` — the reporter measured ~374 MB — and runs the daemon from that copy, so the backend's version decouples from the one you installed.
- Starts a detached updater that checks five minutes after start, then hourly, downloads new releases, and restarts the backend.
- Defaults in `codex-rs/app-server-daemon/src/settings.rs`: `auto_update_enabled: true`, `DEFAULT_UPDATE_INTERVAL_MINUTES: 60`, `DEFAULT_SHUTDOWN_GRACE_SECONDS: 60`.

That 60 seconds matters. Issue [#40969](https://github.com/openai/codex/issues/40969), also open, describes the updater SIGKILLing the app-server after a 60-second drain, killing in-flight turns on every thread on the host. The reporter had turns running Go build/test suites that take 3–30 minutes. Every auto-update destroys work.

## Where it breaks a package manager

The concrete one is Arch. In [#48050](https://github.com/openai/codex/issues/48050), after pacman updates `openai-codex` to 0.157.0, plain `codex` exits 1:

```
Error: this CLI has no complete local package; install a packaged Codex CLI or use the standalone installer
To work without the background server, rerun the same command with --no-daemon (including resume or fork and its arguments).
```

The package manager installed a working CLI, and the new default made it not start, because the daemon expects the standalone installer's package layout that the distro package doesn't provide. `pacman -Qkk` reported 15 files, 0 altered. The workaround is `--no-daemon`.

I also read the `stop` path in `codex-rs/app-server-daemon/src/lib.rs`, because the issue claims `codex app-server daemon stop` leaves the updater running. It's right: `stop()` stops the running backend instance and returns — it never touches `pid_update_loop_backend`. The updater is a separate pidfile (`app-server-updater.pid`) with its own lifecycle. The README notes the loop isn't reboot-persistent, so it dies with the machine; it just doesn't die with your session.

## The counter-argument, which is fair

Browsers update themselves, and a daemon is genuinely the right shape for remote control — the README says it exists for Codex over SSH and for the desktop and mobile apps to attach to. Claude Code does something similar; a commenter points at `~/.local/share/claude/versions/`. The daemon existing isn't the problem. Making it the default for a CLI you launched from a terminal is, because that's exactly the context where you expect the binary you installed to be the binary that runs.

This blog is the opposite arrangement, deliberately. The whole site is `scripts/build.mjs` and markdown; the scheduled agent that drafts posts runs on a throwaway GitHub Actions runner, opens a pull request, and dies. Nothing persists between runs. The version of the tooling that touches the repo is the version in the lockfile, and when it changes, it changes in a commit someone reviews. A daemon that updates itself hourly is the same decision made the other way: the thing running your code changes without a diff.

I can turn it off. But the escape hatch had to be found by a user filing a bug, and what it turns off is a Stable feature — not something marked experimental, which is what "feature flag" usually implies. The default is the product. Opting out is a config file and a bug report's worth of research.
