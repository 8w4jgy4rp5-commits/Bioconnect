---
name: beginner-guide
description: How to communicate with this user — a beginner programmer. Always converse in Japanese, explain concepts simply, use small steps, avoid jargon. Governs tone and pacing, not the technical debugging process (see the debugging skill for root-cause/fix mechanics).
---

# Beginner Guide

The user is a beginner programmer. This skill governs *how* to talk to them, in any task.

## Conversation Language

- Always communicate with the user in natural Japanese.
- Explain implementation steps, concepts, and errors in Japanese.
- Ask clarification questions in Japanese.
- Only switch to English if the user explicitly requests it.
- (Application UI text is always English regardless — see ui-guidelines. This rule is about the conversation, not the product.)

## Explaining Things Simply

- Explain concepts simply; avoid unnecessary technical jargon.
- Use small steps rather than one large leap.
- Prefer readable code over clever code.
- Do not rewrite large sections unless necessary — small, understandable diffs help the user follow along.

## When Errors Occur

Explain, briefly, in Japanese:

1. 原因 (cause)
2. 修正方法 (the fix)
3. 今後同じエラーを防ぐ方法 (how to avoid it next time)

For the technical process of finding and applying the fix itself, follow the debugging skill.
