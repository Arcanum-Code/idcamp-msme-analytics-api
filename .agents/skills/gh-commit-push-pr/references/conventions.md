# Branch Naming and Commit Conventions

## Branch Names

Format: `<type>/<short-description>`

| Type | When to use | Example |
|------|------------|---------|
| `feat` | New feature or capability | `feat/add-user-search` |
| `fix` | Bug fix | `fix/cart-null-pointer` |
| `chore` | Maintenance, deps, config | `chore/update-dependencies` |
| `docs` | Documentation only | `docs/api-usage-guide` |
| `refactor` | Code restructure, no behavior change | `refactor/extract-auth-module` |
| `test` | Adding or fixing tests | `test/payment-edge-cases` |
| `ci` | CI/CD pipeline changes | `ci/add-lint-step` |

Rules:
- Lowercase, hyphens only (no underscores, no spaces)
- Max ~50 characters for the description portion
- No issue numbers in branch name (put those in the commit message)

## Commit Messages

### Format

```
<Summary line — imperative, max ~72 chars>

<Optional body — explain why, not what. Wrap at 72 chars.>

<Optional footer — issue refs, breaking changes.>
```

### Summary Line

- Start with imperative verb: Add, Fix, Update, Remove, Refactor, Extract, Implement
- No trailing period
- Max ~72 characters (hard limit: stays readable in `git log --oneline`)

Good:
```
Add fuzzy search to user directory
Fix crash when cart is empty on checkout
Remove deprecated v1 API endpoints
```

Bad:
```
Added stuff                              # past tense, vague
fixed the bug with the thing             # lowercase, vague
Update files                             # which files? why?
WIP                                      # not a commit message
```

### Body (when to include)

Include a body when:
- The "why" isn't obvious from the summary
- Multiple files changed for non-trivial reasons
- There's context a reviewer needs (trade-offs, alternatives considered)

Skip the body when:
- Single-file change with an obvious summary
- The diff is self-explanatory (e.g., typo fix, dep bump)

### Footer

```
Fixes #123              # auto-closes issue on merge
Closes #456             # same as Fixes
Refs #789               # references without closing
BREAKING CHANGE: <desc> # signals breaking change
```

## What NOT to Commit

Never commit:
- `.env`, `.env.local`, `.env.production`
- `credentials.json`, `service-account.json`
- Private keys: `*.pem`, `*.key`, `id_rsa`, `id_ed25519`
- Token files: `*token*.json`, `.npmrc` with tokens
- `node_modules/`, `__pycache__/`, `.venv/`, `dist/` (should be in `.gitignore`)
- Large binaries unless intentional (images, PDFs, ZIPs)

If you accidentally staged a sensitive file:
```
git reset HEAD <file>
```

If it was already committed:
```
# This rewrites history — coordinate with your team
git rm --cached <file>
echo "<file>" >> .gitignore
git commit -m "Remove accidentally committed <file>"
```
