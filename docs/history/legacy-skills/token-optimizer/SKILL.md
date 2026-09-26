---
name: token-optimizer
description: Keep responses and tool usage lean across this whole project — read only necessary files, don't restate unchanged code, keep summaries short. This is a standing constraint to apply throughout every task here, not a one-time lookup.
---

# Token Optimizer

Standing output-discipline rules for this project. Apply continuously, not just when explicitly asked to "be concise."

- Be concise; don't repeat an explanation already given earlier in the conversation.
- Read only the files necessary for the current task — don't scan the whole project "just in case."
- Modify only the necessary parts of a file; avoid large refactors.
- Never reprint code that didn't change. When showing a diff/result, show only what changed.
- Keep before/after summaries short (a few lines), expanding only when the user asks for more detail.
