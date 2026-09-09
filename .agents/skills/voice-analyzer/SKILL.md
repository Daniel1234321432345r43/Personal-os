---
name: voice-analyzer
description: Analyze the user's writing samples and create a portable VOICE.md style guide for generating new content in the user's own voice. Use when the user wants the AI to write like them, copy their writing style, create a voice profile, or refresh an existing style guide.
user-invocable: true
---

# Voice Analyzer

Create a reusable writing-voice profile from samples supplied by the user. The profile describes style patterns, not the author's identity, beliefs, or personal facts.

## Quick start

Ask the user for 3–5 samples in which their natural voice is strongest. Prefer 500–2,000 words per sample and include the intended contexts when known: casual, professional, academic, technical, social, or creative.

Good samples include:

- Emails or messages the user wrote naturally.
- Blog posts, essays, newsletters, or scripts they authored.
- Explanations or opinions that sound recognizably like them.
- Samples from more than one context if they want separate profiles.

Do not use writing the user does not own or have permission to provide. Do not claim that the resulting text is authored by another person. If the user names a living author, offer to capture high-level traits such as sentence length, formality, pacing, and use of dialogue rather than reproducing a distinctive living author's voice.

## Analysis process

1. Read every sample once without extracting rules.
2. Inventory recurring patterns across the corpus, not one-off quirks.
3. Analyze:
   - Sentence length, complexity, openings, fragments, and variation.
   - Vocabulary, formality, jargon, slang, fillers, and repeated phrases.
   - Paragraph length, transitions, pacing, and openings/closings.
   - Tone, humor, directness, emotional range, and reader relationship.
   - Use of lists, headings, examples, analogies, formatting, and punctuation.
   - How the writer states opinions, qualifies uncertainty, uses I/we/you, and handles disagreement.
4. Separate stable voice characteristics from topic-specific facts, names, claims, and private details. Do not place private facts into the reusable profile unless the user explicitly asks.
5. Compare the corpus against generic AI writing and identify patterns that would make output sound unlike the user.
6. Produce a profile with concrete examples, measurable targets where useful, and a forbidden-list tailored to the samples.
7. Ask the user to validate the profile with a short test before treating it as final.

## Output

Create `.claude/VOICE.md` for a project-scoped profile unless the user specifies another location. Do not overwrite an existing profile without asking first. Use this structure:

```markdown
# Voice Profile: [name or context]
Generated: [date]
Based on: [number] samples ([approximate word count] words)

## Voice Summary
[2–3 sentences describing the overall voice]

## Core Characteristics
### Sentence Patterns
- Average length and natural range:
- Variation and rhythm:
- Common sentence starters:
- Fragments or emphasis:

### Vocabulary Fingerprint
- Formality:
- Characteristic phrases:
- Preferred words and expressions:
- Words or expressions absent from the samples:

### Rhythm and Flow
- Typical paragraph length:
- Transition habits:
- Pacing:
- Openings and closings:

### Tone and Reader Relationship
- Primary tone:
- Humor:
- Directness:
- Emotional range:
- Relationship with the reader:

### Structure and Formatting
- Prose versus lists:
- Headings and sections:
- Examples and analogies:
- Punctuation and formatting:

### Opinion and Authority
- Confidence level:
- Qualification and uncertainty:
- Use of I/we/you:
- Disagreement style:

## Rules for New Writing
- [specific rule]
- [specific rule]
- [specific rule]

## The Forbidden List
### Avoid
- [generic phrase or pattern that conflicts with the corpus]

### Use Sparingly
- [context-dependent phrase or pattern]

### Watch for Clusters
- [patterns that are acceptable individually but sound artificial together]

## Few-shot Examples
> [short excerpt from the user's samples, if the user authorizes retaining it]

## Modes
- Casual:
- Professional:
- Technical:
- Long-form:

## Validation Prompts
1. Write a short response about [relevant context].
2. Write two opening paragraphs about [relevant topic].
3. Explain [edge-case topic] while preserving the profile.

## Maintenance
- Recheck three recent pieces monthly.
- Refresh the profile quarterly or after a noticeable change in voice.
- Keep multiple profiles when casual and professional voices differ.
```

## Quality checks

Before saving, confirm every major dimension has evidence from multiple samples, the forbidden list contains at least 10 useful items when the corpus supports that precision, and no personal facts were invented. State clearly that the profile improves consistency but cannot guarantee indistinguishable authorship; the user should review important output.
