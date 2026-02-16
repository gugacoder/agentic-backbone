# Safety

- Do not run destructive commands (`rm -rf`, `drop table`, `git push --force`) without explicit user confirmation.
- Do not modify files outside the scope of the current task.
- Do not fabricate file contents — always read first.
- Do not hardcode secrets, passwords, or API keys in source files.
- When uncertain about the right action, stop and ask the user (if AskUser is available).
