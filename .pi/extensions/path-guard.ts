/**
 * Path guard — a real allowlist for what an unattended Pi run can write to,
 * not just a line in a prompt asking it nicely.
 *
 * `draft-post.yml` and `evolve-agents.yml` both tell Pi in the prompt not to
 * touch certain files ("do not touch posts/", "only edit SOUL.md"). A prompt
 * is a request the model can misread or drift from over a long run; this is
 * the same idea enforced in the harness, where it can't be talked out of it.
 *
 * Configure per run with the PI_PATH_GUARD_ALLOW env var: a comma-separated
 * list of path prefixes (relative to the working directory) the run may
 * write or edit. Unset or empty disables the guard entirely — it is opt-in,
 * so interactive/local use of pi is never affected by this file's presence.
 *
 * Scope, honestly stated (see docs/security.md — pi has no built-in sandbox):
 * - The `write` and `edit` tools are fully covered: every call is checked
 *   against the allowlist before it runs, no exceptions.
 * - The `bash` tool is covered on a best-effort basis: a command containing
 *   an obvious write (`>`, `>>`, `tee`, `sed -i`, `cp`, `mv`, `rm`) aimed at
 *   a path outside the allowlist is blocked. This is a backstop against an
 *   honest mistake (the agent doing by shell what the prompt told it not to
 *   do by tool), not a security boundary — a model that was actually trying
 *   to evade it could still find a way through bash. For that threat model,
 *   use a container or VM (see docs/containerization.md), not this.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import path from "node:path";

export default function (pi: ExtensionAPI) {
  const raw = process.env.PI_PATH_GUARD_ALLOW;
  if (!raw?.trim()) return;

  const allow = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => path.normalize(p).replace(/\\/g, "/"));

  const isAllowed = (p: string) => {
    const norm = path.normalize(p).replace(/\\/g, "/").replace(/^\.\//, "");
    return allow.some((a) => norm === a || norm.startsWith(a.endsWith("/") ? a : `${a}/`));
  };

  const denyReason = (p: string) => `path-guard: "${p}" is outside the allowed paths for this run (${allow.join(", ")})`;

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
      if (!isAllowed(p)) {
        if (ctx.hasUI) ctx.ui.notify(`Blocked ${event.toolName} on "${p}"`, "warning");
        return { block: true, reason: denyReason(p) };
      }
      return undefined;
    }

    if (isToolCallEventType("bash", event)) {
      for (const target of bashTargets(event.input.command)) {
        if (!isAllowed(target)) {
          if (ctx.hasUI) ctx.ui.notify(`Blocked bash write to "${target}"`, "warning");
          return { block: true, reason: denyReason(target) };
        }
      }
    }

    return undefined;
  });
}
