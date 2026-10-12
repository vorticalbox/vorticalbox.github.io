/**
 * Path guard — a real allow/deny list for what an unattended Pi run can
 * write to, not just a line in a prompt asking it nicely.
 *
 * Two independent, composable env vars:
 *
 *   PI_PATH_GUARD_ALLOW — comma-separated path prefixes. If set, ONLY these
 *     may be written/edited; everything else is blocked. Use for a narrowly
 *     scoped job (draft-post.yml: posts/ only).
 *
 *   PI_PATH_GUARD_DENY — comma-separated path prefixes. If set, these are
 *     ALWAYS blocked, regardless of ALLOW. Use for a broadly scoped job that
 *     should be able to touch almost anything except a specific few paths
 *     (evolve-agents.yml: everything except its own workflow files and this
 *     extension, so it can't quietly weaken its own guard).
 *
 * Set both and deny wins on overlap. Set neither and the guard does nothing
 * — it is entirely opt-in, so interactive/local use of pi is never affected
 * by this file's presence.
 *
 * Scope, honestly stated (see docs/security.md — pi has no built-in sandbox):
 * - The `write` and `edit` tools are fully covered: every call is checked
 *   before it runs, no exceptions.
 * - The `bash` tool is covered on a best-effort basis: a command containing
 *   an obvious write (`>`, `>>`, `tee`, `sed -i`, `cp`, `mv`, `rm`) aimed at
 *   a blocked path is blocked. This is a backstop against an honest mistake
 *   (the agent doing by shell what the prompt told it not to do by tool),
 *   not a security boundary — a model that was actually trying to evade it
 *   could still find a way through bash. For that threat model, use a
 *   container or VM (see docs/containerization.md), not this.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import path from "node:path";

function parseList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => path.normalize(p).replace(/\\/g, "/"));
}

function matches(list: string[], p: string): boolean {
  const norm = path.normalize(p).replace(/\\/g, "/").replace(/^\.\//, "");
  return list.some((a) => norm === a || norm.startsWith(a.endsWith("/") ? a : `${a}/`));
}

export default function (pi: ExtensionAPI) {
  const allow = parseList(process.env.PI_PATH_GUARD_ALLOW);
  const deny = parseList(process.env.PI_PATH_GUARD_DENY);
  if (!allow.length && !deny.length) return;

  const isBlocked = (p: string) => {
    if (deny.length && matches(deny, p)) return true;
    if (allow.length && !matches(allow, p)) return true;
    return false;
  };

  const denyReason = (p: string) => {
    if (deny.length && matches(deny, p)) return `path-guard: "${p}" is explicitly off-limits for this run (${deny.join(", ")})`;
    return `path-guard: "${p}" is outside the allowed paths for this run (${allow.join(", ")})`;
  };

  // Matches a write-shaped bash command (`> file`, `sed -i file`, `tee file`,
  // `cp a file`, `mv a file`, `rm file`) and pulls out the target path. Best
  // effort on purpose — see module docstring.
  const WRITE_CMD = /(?:^|&&|;|\|)\s*(?:sed\s+-i\S*\s+\S+\s+|tee\s+(?:-a\s+)?|cp\s+\S+\s+|mv\s+\S+\s+|rm\s+(?:-\w+\s+)?)([^\s;&|>]+)|>>?\s*([^\s;&|]+)/g;

  function bashTargets(command: string): string[] {
    const out: string[] = [];
    for (const m of command.matchAll(WRITE_CMD)) {
      const target = m[1] ?? m[2];
      if (target) out.push(target.replace(/^['"]|['"]$/g, ""));
    }
    return out;
  }

  pi.on("tool_call", async (event, ctx) => {
    if (isToolCallEventType("write", event) || isToolCallEventType("edit", event)) {
      const p = event.input.path;
      if (isBlocked(p)) {
        if (ctx.hasUI) ctx.ui.notify(`Blocked ${event.toolName} on "${p}"`, "warning");
        return { block: true, reason: denyReason(p) };
      }
      return undefined;
    }

    if (isToolCallEventType("bash", event)) {
      for (const target of bashTargets(event.input.command)) {
        if (isBlocked(target)) {
          if (ctx.hasUI) ctx.ui.notify(`Blocked bash write to "${target}"`, "warning");
          return { block: true, reason: denyReason(target) };
        }
      }
    }

    return undefined;
  });
}
