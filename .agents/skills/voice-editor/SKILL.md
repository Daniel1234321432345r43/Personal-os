---
name: voice-editor
description: Rewrite or edit a draft so it matches the user's project voice profile in .claude/VOICE.md. Use when the user asks to make text sound like them, apply their style, or remove generic AI phrasing.
user-invocable: true
---

# Voice Editor

Apply the user's own `VOICE.md` profile to a draft while preserving the draft's facts, intent, audience, and requested format.

## Workflow

1. Locate `.claude/VOICE.md` or the profile path named by the user. If none exists, ask for writing samples and use `voice-analyzer` first.
2. Identify the requested editing mode:
   - **Light:** polish rhythm and remove obvious generic phrasing.
   - **Standard:** apply structure, voice, specificity, rhythm, and authenticity passes.
   - **Heavy:** rewrite substantially while preserving the core facts and purpose.
3. Review the draft for generic AI patterns, unnecessary hedging, corporate language, uniform sentence lengths, and voice drift.
4. Match the profile's vocabulary, sentence rhythm, paragraph habits, tone, directness, formatting, and uncertainty handling.
5. Preserve factual claims unless the user explicitly requests fact-checking. Mark unclear or unsupported claims instead of inventing details.
6. Do a final read-aloud and authenticity check: would the user's intended audience recognize the writing as theirs?

## Output

By default, return the revised text first. If the user asks for an explanation, include a concise edit summary with:

- Mode and estimated amount changed.
- Major structure and voice adjustments.
- Generic patterns removed.
- Any remaining mismatch or factual concern.
- Suggested updates to `VOICE.md`.

Do not expose private sample content unnecessarily. Do not reproduce a living author's distinctive style. If the requested target is another identifiable author, redirect to high-level traits and ask for the user's own voice profile.

## Important limits

A voice profile guides style; it does not transfer identity, memories, opinions, or authorship. Keep the user's original meaning and require human review for sensitive, public, or high-stakes writing.
