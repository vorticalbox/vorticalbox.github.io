#!/usr/bin/env node
/**
 * Turns Pi's `--mode json` event stream into a readable progress log, and
 * captures the agent's final message.
 *
 * Why this exists: `pi --print` buffers everything and prints once at the end,
 * so a ten-minute run is a blank step in the Actions log. With `--mode json`
 * Pi emits one JSON event per action, which this reads as it arrives and
 * prints a line per tool call to stderr (stderr appears live in the log).
 *
 * It also fixes a worse problem: the step that opens the PR decides whether to
 * act by looking at `git status`. An agent that crashed and an agent that
 * deliberately wrote nothing both leave no changes, so a broken run used to
 * report success. Run this under `set -o pipefail` so a failure here fails
 * the step, and a crash can no longer masquerade as a quiet run.
 *
 * That "run this under pipefail" half is necessary but not sufficient: `pi`
 * itself exits 0 even when the model call failed outright (checked directly —
 * a provider returning an HTTP error page still produces a well-formed
 * `message_end` event with `stopReason: "error"` and an empty content array,
 * and `pi`'s own process exit code is 0 regardless). Left unchecked, that
 * error event just looks like a turn that produced no final text — which,
 * same as before, is indistinguishable from a deliberately quiet run. So this
 * script watches for `stopReason: "error"` itself and sets its *own* exit
 * code to 1 when the last thing the agent did was fail, which is what
 * `pipefail` actually needs to have something real to propagate.
 *
 * Usage:  pi --mode json ... | node live-log.mjs <summary-output-path>
 */
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const outPath = process.argv[2];
const short = (s, n = 110) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

/** The interesting bit of a tool call, whatever the tool. */
function detail(args = {}) {
  return args.command ?? args.path ?? args.pattern ?? args.query ?? args.url ?? JSON.stringify(args);
}

let finalText = '';
let toolCount = 0;
const errors = [];
// The most recent assistant turn's failure, if the agent ended on one. Reset
// to null whenever a later turn produces real content, so a transient error
// pi recovered from (it retried and got a good answer) is not treated as
// fatal — only the state at the end of the stream matters.
let lastError = null;

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  let ev;
  try {
    ev = JSON.parse(line);
  } catch {
    return; // not a protocol record; ignore
  }

  switch (ev.type) {
    case 'tool_execution_start':
      toolCount += 1;
      process.stderr.write(`→ ${ev.toolName}: ${short(detail(ev.args))}\n`);
      break;

    case 'tool_execution_end':
      if (ev.isError) errors.push(ev.toolName);
      process.stderr.write(
        `  ${ev.isError ? '✗' : '✓'} ${ev.toolName} (${((ev.durationMs ?? 0) / 1000).toFixed(1)}s)\n`,
      );
      break;

    case 'message_end': {
      const m = ev.message;
      if (m?.role !== 'assistant') break;
      if (m.stopReason === 'error') {
        lastError = m.errorMessage || '(no error message provided)';
        process.stderr.write(`✗ model call failed: ${short(m.errorMessage, 300)}\n`);
        break;
      }
      lastError = null; // this turn succeeded — any earlier error was recovered from
      if (Array.isArray(m.content)) {
        const text = m.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        if (text) finalText = text; // last assistant text is the final message
      }
      break;
    }
  }
});

rl.on('close', () => {
  process.stderr.write(`\n--- ${toolCount} tool call(s), ${errors.length} tool error(s) ---\n`);
  if (outPath) {
    writeFileSync(outPath, finalText ? `${finalText}\n` : '');
    process.stderr.write(`--- final message (${finalText.length} chars) -> ${outPath} ---\n`);
    if (!finalText) process.stderr.write('WARNING: no final assistant text was captured\n');
  }
  if (lastError) {
    process.stderr.write(`\nFATAL: the run ended on a failed model call, not a deliberate quiet run:\n${lastError}\n`);
    process.exitCode = 1;
  }
});
