<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Readiness task completion and branches

- Explicitly announce when each R task is complete, distinguishing verified application work from any remaining Git handoff.
- Before starting the next R task, tell the user the intended branch name and verify that the workspace is on that branch.
- If the workspace is still on an earlier task's branch or contains uncommitted earlier work, explain that before proceeding and preserve that work during the handoff.
- Do not begin implementation for the next R task until the correct branch has been verified.
