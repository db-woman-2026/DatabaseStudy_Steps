# AGENTS.md

- Preserve the cumulative branch chain: `main -> step-1 -> ... -> step-8`.
- Project-wide changes start on `main` and merge forward one branch at a time.
- Step-specific changes start on the earliest affected `step-N` branch and merge forward sequentially.
- Do not copy the same change into multiple branches as unrelated commits.
- After propagation, verify every adjacent pair with `git merge-base --is-ancestor`.
- Keep this course independent from `NodeStudy_Steps`; Node.js is only the execution runtime.
- Use only the dedicated SQLite files and the MongoDB database named by `MONGODB_DB`.
