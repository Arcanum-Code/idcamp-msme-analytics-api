# Pull Request Body Template

Use this structure when the repo doesn't have its own PR template.

---

## Minimal (for small, obvious changes)

```
## Summary
- <one-liner describing what changed and why>

## Test plan
- [ ] <how to verify>
```

## Standard (for feature work, bug fixes)

```
## Summary
<1-3 sentences: what this PR does and why>

## Changes
- <bullet per logical change>

## Test plan
- [ ] <step-by-step verification>
- [ ] <edge case checked>

## Notes
<anything reviewers should know: trade-offs, follow-ups, related issues>
```

## With Issue Reference

```
## Summary
Fixes #<number>

<1-2 sentences explaining the approach taken>

## Changes
- <bullet per logical change>

## Test plan
- [ ] <repro steps from issue now pass>
- [ ] <no regressions in related area>
```

---

## Guidelines

- **Title**: Imperative mood, max ~72 chars. Match the commit summary.
  - Good: "Add user search endpoint", "Fix null pointer on empty cart"
  - Bad: "Added stuff", "WIP", "changes", "PR for issue 42"
- **Summary**: Answer "why" before "what". The diff shows what changed; the summary explains the intent.
- **Test plan**: Concrete steps, not "tested locally". What commands to run, what to check.
- **Keep it short**: If the PR is small and the title is self-explanatory, the minimal template is fine. Don't pad.
