# Murmr

*A voice-to-text flow for multilingual speakers who code-switch.*

## Overview

A surprising number of people don't speak in a single language. A Chinese American engineer drops Mandarin phrases into English Slack messages because the English word for `撒娇` doesn't quite land. A bilingual designer narrates a Figma walkthrough in Spanish and English because that's how she actually thinks. Voice-to-text products like Wispr Flow are great at the single-language case, but the moment a speaker mixes languages mid-sentence, most transcription tools either pick the wrong language and garble everything, or pick one language up front and force the speaker to translate in their head.

You're going to build a small voice-flow that handles this. The user speaks (we stub the speech-to-text). The transcript preserves the code-switched mix exactly as spoken, visually distinguishing the languages so the user can read it. A translate button normalizes the whole transcript into one target language, preserving meaning even when culturally-loaded phrases don't translate word-for-word.

## Problem Statement

Build a voice transcription UI for multilingual speakers. The transcription must preserve code-switched mixed-language input verbatim with per-segment language tagging. A translate action normalizes the transcript to a single chosen target language, treating the segmented transcript as one input so the translation reads coherently rather than as a stitched-together patchwork.

## Getting Started

### Prerequisites
- Node.js 20+
- Any modern framework (Next.js, Vite + React, SvelteKit). Starter is Next.js.

### Setup
Dependencies are installed automatically when you initialize the assessment with the Litmus CLI. You're ready to start coding.

Files in the workspace:
- `data/sample_utterances.json` provides 6 sample mixed-language utterances (Chinglish, Spanglish, Hinglish, Franglais, Japanese-English, code-review Chinglish). Each is a sequence of language-tagged segments with timestamps.
- `stt_stub.ts` simulates the speech-to-text service. Given an utterance id, streams transcript segments at realistic cadence. Replaced at grade time by a real STT service.
- `llm_stub.ts` simulates the translation LLM. Given the segmented transcript plus a target language, streams the translation. Replaced at grade time by a real LLM.
- `types.ts` defines the `Segment` and `Transcript` shapes.

## Requirements

1. A "Start dictation" action begins a session. Pick an utterance from `sample_utterances.json` (let the user choose via a dropdown, or pick one by default). The transcript streams in from `stt_stub.transcribe()` as language-tagged segments.
2. The transcript display preserves the language tagging visually. Two consecutive segments of different languages must be clearly distinguishable (color, font, badge, your call). The user can read the transcript and tell at a glance which words were spoken in which language.
3. Each segment is editable. Click into a segment, edit the text, the segment keeps its original language tag (editing a Mandarin segment does not reclassify it as English unless the user explicitly changes the language).
4. A target-language picker lets the user choose a normalization language. Support at least English, Mandarin, Spanish, Hindi, French.
5. A "Translate" button kicks off translation by calling `llm_stub.translate()` with the full `Transcript` object plus the chosen target. Translation streams into the UI replacing the original transcript. An "Undo translation" action reverts to the original.
6. The translation must treat the whole transcript as one input, not a sequence of per-segment translations. Per-segment translation produces stitched-together output that reads awkwardly when source segments end mid-thought. Your call to `llm_stub.translate()` passes one `Transcript` argument, not N segments.

## Examples

**Example 1: Chinglish meeting recap**
```
Spoken (sample u1):
  [zh] 我今天
  [en] had a meeting with my manager
  [zh] 然后
  [en] he said the deadline is next Friday

Displayed: each segment visibly tagged by language. User can read and edit.

Target = en, Translate clicked:
  "Today I had a meeting with my manager, and he said the deadline is next Friday."
```

**Example 2: Spanglish weekend plans**
```
Spoken (sample u2):
  [en] So like,
  [es] este fin de semana
  [en] I'm going to the beach with
  [es] mi familia

Target = es, Translate clicked:
  "Entonces, este fin de semana voy a la playa con mi familia."
```

**Example 3: Edit then translate**
```
User edits the second segment of u3 from " butter chicken " to " palak paneer ".
Clicks Translate to Hindi.
Output reflects the edit, naturally phrased in Hindi.
```

## Submission Guidelines

### What to Submit
- All source code (frontend, any server-side proxies, anything else you build).

### How to Submit
```bash
litmus submit
```
