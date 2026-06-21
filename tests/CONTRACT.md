# Contract checklist

The grader exercises the following behaviors. These are the things to make work.

## Streaming transcript
- "Start dictation" picks an utterance and streams segments via `stt_stub.transcribe()`.
- Each segment appears in the UI as it arrives. No buffering the full transcript before render.

## Language-tagged display
- Each segment is visually distinguishable by language. Two consecutive segments of different languages are clearly demarcated.
- The choice of visual treatment (color, font, badge) is yours; the grader checks that adjacent different-language segments are not visually identical.

## Editing preserves language
- Clicking into a segment makes its text editable.
- After edit, the segment retains its original language tag.

## Target-language picker
- A dropdown or similar control lets the user choose target language.
- At least `en`, `zh`, `es`, `hi`, `fr` are present.

## Translate
- Clicking "Translate" calls `llm_stub.translate(transcript, target)` with the FULL `Transcript` object plus the chosen target.
- Translation streams into the UI, replacing the original transcript view.
- "Undo translation" reverts to the original transcript.

## Whole-transcript translation, not per-segment
- The grader inspects the call site: `translate()` is invoked once with the full `Transcript`, not N times with individual segments.
- A naive per-segment-then-concatenate implementation fails this check.

## Visual + interaction taste
- The mixed-language display is readable, not just functional.
- Streaming UI does not jank.
- Empty / loading / error states are designed (not just bare HTML).
