// stt_stub.ts — stubbed speech-to-text service.
//
// Given an utterance id, streams transcript segments back at realistic
// cadence. Replaced at grade time by a real STT service that accepts audio.
// Your code should depend only on the public API below.

import sample from "./data/sample_utterances.json"
import type { Segment } from "./types"

export interface STTStream {
  utteranceId: string
  segments: AsyncIterable<Segment>
}

export function transcribe(utteranceId: string): STTStream {
  const utterance = (sample as { utterances: Array<{ id: string; segments: Segment[] }> })
    .utterances.find((u) => u.id === utteranceId)
  if (!utterance) {
    throw new Error(`unknown utterance: ${utteranceId}`)
  }

  async function* stream(): AsyncIterable<Segment> {
    for (const seg of utterance.segments) {
      // Per-segment latency: 200-800ms
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 600))
      yield seg
    }
  }

  return { utteranceId, segments: stream() }
}

export function listUtterances(): Array<{ id: string; label: string }> {
  return (sample as { utterances: Array<{ id: string; label: string }> }).utterances.map((u) => ({
    id: u.id,
    label: u.label,
  }))
}
