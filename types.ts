// types.ts — shared types for the multi-language transcription flow.

export type LanguageCode = "en" | "zh" | "es" | "hi" | "fr" | "ja" | "ko" | "pt" | "ar"

export interface Segment {
  /** Stable id for the segment. Use for keyed rendering + editing. */
  id: string
  /** Language of this segment (BCP-47-ish code). */
  lang: LanguageCode
  /** The text in its original language as spoken. */
  text: string
  /** Start time from the beginning of the utterance, in ms. */
  tMs: number
  /** Duration in ms (optional). */
  durationMs?: number
}

export interface Transcript {
  id: string
  segments: Segment[]
  /** True when STT has finished streaming. */
  complete: boolean
}

export interface TranslationOptions {
  target: LanguageCode
}

export interface TranslationResult {
  text: string
  target: LanguageCode
}
