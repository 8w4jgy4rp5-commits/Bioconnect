---
name: debugging
description: Use when fixing a bug or investigating an error in a mini app or the platform. Root-cause first, apply the minimal fix, avoid unnecessary refactoring. Pairs with beginner-guide for how to phrase the explanation to the user.
---

# Debugging

Process rules for fixing bugs, distinct from how the explanation is phrased (that's beginner-guide).

## Process

1. Find the smallest possible root cause — reproduce or read the code path before guessing.
2. Apply the minimum necessary fix. Do not rewrite large sections unnecessarily.
3. Do not use the fix as an excuse to refactor unrelated code, add abstractions, or "clean up while you're in there."
4. If the bug is in localStorage data handling, check it against platform-rules' safe-parsing convention before assuming it's a one-off.

## After Fixing

Briefly explain in Japanese (per beginner-guide's tone rules):

- 原因 (root cause)
- 修正内容 (fix applied)
- 影響範囲 (impact — what this does and doesn't affect)
