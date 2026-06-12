#!/bin/bash
# Prepare a commit by summarizing current changes, detecting sensitive files,
# and suggesting a commit message.
#
# Usage: prepare_commit.sh [path-to-repo]
#
# Outputs structured info that helps compose a good commit:
# - Files changed (staged vs unstaged)
# - Diff stats
# - Sensitive file warnings
# - Suggested commit message

set -e

REPO="${1:-.}"
cd "$REPO"

# --- Branch info ---
BRANCH=$(git branch --show-current 2>/dev/null || echo "DETACHED")
echo "=== BRANCH ==="
echo "Current: $BRANCH"

if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
    echo "WARNING: On $BRANCH — create a feature branch before committing"
fi

if [ "$BRANCH" = "DETACHED" ]; then
    echo "WARNING: HEAD is detached — create a branch before committing"
fi

echo ""

# --- Staged changes ---
echo "=== STAGED CHANGES ==="
STAGED=$(git diff --cached --name-status 2>/dev/null)
if [ -z "$STAGED" ]; then
    echo "(none)"
else
    echo "$STAGED"
fi

echo ""

# --- Unstaged changes ---
echo "=== UNSTAGED CHANGES ==="
UNSTAGED=$(git diff --name-status 2>/dev/null)
if [ -z "$UNSTAGED" ]; then
    echo "(none)"
else
    echo "$UNSTAGED"
fi

echo ""

# --- Untracked files ---
echo "=== UNTRACKED FILES ==="
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null)
if [ -z "$UNTRACKED" ]; then
    echo "(none)"
else
    echo "$UNTRACKED"
fi

echo ""

# --- Diff stats ---
echo "=== DIFF STATS ==="
# Show stats for what would be committed (staged), or all changes if nothing staged
if [ -n "$STAGED" ]; then
    git diff --cached --stat
else
    git diff --stat
fi

echo ""

# --- Sensitive file detection ---
echo "=== SENSITIVE FILE CHECK ==="
ALL_CHANGED=$(git diff --cached --name-only 2>/dev/null; git diff --name-only 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null)
SENSITIVE_PATTERNS='.env|\.env\.|credentials|secret|\.pem$|\.key$|\.p12$|\.pfx$|\.keystore|password|token.*\.json|auth.*\.json|\.npmrc$|\.pypirc$|id_rsa|id_ed25519'
SENSITIVE=$(echo "$ALL_CHANGED" | grep -iE "$SENSITIVE_PATTERNS" 2>/dev/null || true)

if [ -n "$SENSITIVE" ]; then
    echo "WARNING — these files look sensitive, do NOT commit:"
    echo "$SENSITIVE" | while read -r f; do echo "  !! $f"; done
else
    echo "No sensitive files detected."
fi

echo ""

# --- Binary file detection ---
echo "=== BINARY FILE CHECK ==="
BINARY_FILES=""
for f in $(git diff --cached --name-only 2>/dev/null; git diff --name-only 2>/dev/null); do
    if [ -f "$f" ] && file "$f" | grep -qE 'binary|executable|image|archive|compressed'; then
        BINARY_FILES="$BINARY_FILES  $f\n"
    fi
done

if [ -n "$BINARY_FILES" ]; then
    echo "Binary files in changeset (include only if intentional):"
    echo -e "$BINARY_FILES"
else
    echo "No binary files detected."
fi

echo ""

# --- Suggest commit type ---
echo "=== SUGGESTED COMMIT ==="

ALL_FILES=$(git diff --cached --name-only 2>/dev/null; git diff --name-only 2>/dev/null)

# Detect dominant change type from file paths
HAS_TEST=$(echo "$ALL_FILES" | grep -iE 'test|spec|__tests__' | head -1)
HAS_DOCS=$(echo "$ALL_FILES" | grep -iE 'readme|docs/|\.md$|changelog' | head -1)
HAS_CI=$(echo "$ALL_FILES" | grep -iE '\.github/|\.gitlab|jenkins|circleci|Dockerfile|docker-compose|\.yaml$|\.yml$' | head -1)
HAS_CONFIG=$(echo "$ALL_FILES" | grep -iE 'config|\.eslint|\.prettier|tsconfig|package\.json$|requirements\.txt' | head -1)
FILE_COUNT=$(echo "$ALL_FILES" | sort -u | wc -l | tr -d ' ')

# Pick the most likely type
if [ -n "$HAS_TEST" ] && [ "$FILE_COUNT" -le 3 ]; then
    TYPE="test"
elif [ -n "$HAS_DOCS" ] && [ "$FILE_COUNT" -le 3 ]; then
    TYPE="docs"
elif [ -n "$HAS_CI" ] && [ "$FILE_COUNT" -le 3 ]; then
    TYPE="ci"
elif [ -n "$HAS_CONFIG" ] && [ "$FILE_COUNT" -le 2 ]; then
    TYPE="chore"
else
    # Look at diff content for fix signals
    DIFF_CONTENT=$(git diff --cached 2>/dev/null || git diff 2>/dev/null)
    if echo "$DIFF_CONTENT" | grep -qiE 'fix|bug|error|crash|issue|patch'; then
        TYPE="fix"
    else
        TYPE="feat"
    fi
fi

echo "Type: $TYPE"
echo "Files: $FILE_COUNT changed"
echo ""
echo "Suggested branch name (if creating new):"
# Get first meaningful changed file for naming
FIRST_FILE=$(echo "$ALL_FILES" | head -1 | xargs basename 2>/dev/null | sed 's/\.[^.]*$//' | tr '[:upper:]' '[:lower:]' | tr ' _' '-' | head -c 30)
echo "  $TYPE/${FIRST_FILE:-changes}"
echo ""
echo "Use 'git diff --cached' (or 'git diff' if nothing staged) to review the full diff and write the commit message."
