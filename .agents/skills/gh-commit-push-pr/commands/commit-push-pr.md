---
name: commit-push-pr
description: Commit local changes, push a branch, and create a GitHub PR with preflight safety checks.
argument-hint: "[--base <branch>] [--title <title>] [--draft]"
allowed-tools: [Read, Bash(gh:*), Bash(git:*), Bash(bash skills/gh-commit-push-pr/scripts/prepare_commit.sh:*)]
---

# Commit Push PR Command

Use this wrapper to standardize commit/push/PR creation with safety checks.

## Behavior

1. Run preflight context collection:

```bash
bash skills/gh-commit-push-pr/scripts/prepare_commit.sh
```

2. Verify:
- branch is not detached
- not committing sensitive files
- `gh auth status` passes
- working tree has commit-worthy changes
3. Create a feature branch if on `main`/`master`.
4. Stage intended changes and commit with an imperative message.
5. Push branch to origin.
6. Check for existing PR for head branch before creating a new one.
7. Create PR with summary and test plan (`--draft` when requested).
8. Report branch, commit summary, PR URL, and warnings.

## Rules

- Never force-push as part of this command.
- Use `--body-file` for PR body content to avoid shell interpolation issues.
- If no diff exists against base, stop and report instead of creating a PR.

## Example Invocations

```bash
# Standard flow using repo default base branch
/commit-push-pr

# Create PR against a specific base branch
/commit-push-pr --base main

# Open a draft PR with an explicit title
/commit-push-pr --base main --title "Fix login redirect race" --draft
```
