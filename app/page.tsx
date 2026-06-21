"use client"

import { useState, useEffect, useRef } from "react"
import type { Segment, Transcript, LanguageCode } from "../types"

// ── Language metadata ────────────────────────────────────────────────────────

type LangMeta = { label: string; flag: string; bg: string; text: string; badge: string }

const LANG_META: Record<string, LangMeta> = {
  en: { label: "English", flag: "🇺🇸", bg: "rgba(59, 130, 246, 0.15)", text: "#93C5FD", badge: "#3B82F6" },
  zh: { label: "Mandarin", flag: "🇨🇳", bg: "rgba(239, 68, 68, 0.15)", text: "#FCA5A5", badge: "#EF4444" },
  es: { label: "Spanish", flag: "🇪🇸", bg: "rgba(245, 158, 11, 0.15)", text: "#FCD34D", badge: "#F59E0B" },
  hi: { label: "Hindi", flag: "🇮🇳", bg: "rgba(16, 185, 129, 0.15)", text: "#6EE7B7", badge: "#10B981" },
  fr: { label: "French", flag: "🇫🇷", bg: "rgba(139, 92, 246, 0.15)", text: "#C4B5FD", badge: "#8B5CF6" },
  ja: { label: "Japanese", flag: "🇯🇵", bg: "rgba(236, 72, 153, 0.15)", text: "#F9A8D4", badge: "#EC4899" },
}

const FALLBACK_META: LangMeta = { label: "—", flag: "🏳️", bg: "rgba(148, 163, 184, 0.15)", text: "#cbd5e1", badge: "#94a3b8" }

function langMeta(lang: string): LangMeta {
  return LANG_META[lang] ?? FALLBACK_META
}

function badgeText(lang: string): string {
  if (lang === "zh") return "中"
  if (lang === "ja") return "日"
  return lang.toUpperCase()
}

const TARGET_LANGS: LanguageCode[] = ["en", "zh", "es", "hi", "fr"]

// ── SSE streaming helper ─────────────────────────────────────────────────────

async function* readSSE(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split("\n")
    buf = lines.pop() ?? ""
    for (const line of lines) {
      if (line.startsWith("data: ")) yield line.slice(6)
    }
  }
}

// ── SegmentChip ──────────────────────────────────────────────────────────────

interface SegmentChipProps {
  segment: Segment
  isArriving: boolean
  onEdit: (id: string, text: string) => void
}

function SegmentChip({ segment, isArriving, onEdit }: SegmentChipProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(segment.text)
  const inputRef = useRef<HTMLInputElement>(null)
  const m = langMeta(segment.lang)

  useEffect(() => {
    if (!editing) setDraft(segment.text)
  }, [segment.text, editing])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  function startEdit() {
    setDraft(segment.text)
    setEditing(true)
  }

  function save() {
    setEditing(false)
    onEdit(segment.id, draft)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); save() }
    if (e.key === "Escape") { setEditing(false); setDraft(segment.text) }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setDraft(v)
    if (inputRef.current) {
      inputRef.current.style.width = `${Math.max(2, v.length)}ch`
    }
  }

  return (
    <span
      className={`seg-chip${isArriving ? " seg-chip-arriving" : ""}`}
      style={{
        backgroundColor: m.bg,
        color: m.text,
        "--chip-badge": m.badge,
      } as React.CSSProperties}
      title={`${m.label} — click text to edit`}
    >
      <span className="lang-badge">{badgeText(segment.lang)}</span>
      {editing ? (
        <input
          ref={inputRef}
          className="seg-edit-input"
          value={draft}
          onChange={onInputChange}
          onBlur={save}
          onKeyDown={onKeyDown}
          style={{ width: `${Math.max(2, draft.length)}ch` }}
          aria-label={`Edit ${m.label} segment`}
        />
      ) : (
        <span
          className="seg-text"
          onClick={startEdit}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && startEdit()}
          aria-label={`${m.label}: ${segment.text}. Click to edit.`}
        >
          {segment.text}
        </span>
      )}
    </span>
  )
}

// ── Language key legend ──────────────────────────────────────────────────────

function LanguageKey() {
  return (
    <section className="lang-key" aria-label="Language color key">
      {(["en", "zh", "es", "hi", "fr", "ja"] as const).map((code) => {
        const m = langMeta(code)
        return (
          <span key={code} className="lang-key-item">
            <span className="lang-key-dot" style={{ backgroundColor: m.badge }} />
            {m.label}
          </span>
        )
      })}
    </section>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

type Status = "idle" | "transcribing" | "ready" | "translating" | "translated"

export default function Page() {
  const [utterances, setUtterances] = useState<{ id: string; label: string }[]>([])
  const [selectedId, setSelectedId] = useState<string>("")

  const [segments, setSegments] = useState<Segment[]>([])
  const [transcriptId, setTranscriptId] = useState<string | null>(null)
  const [arrivingId, setArrivingId] = useState<string | null>(null)

  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)

  const [targetLang, setTargetLang] = useState<LanguageCode>("en")
  const [translationText, setTranslationText] = useState<string>("")
  const [showTranslation, setShowTranslation] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetch("/api/utterances")
      .then((r) => r.json())
      .then((data: { id: string; label: string }[]) => {
        setUtterances(data)
        if (data.length > 0) setSelectedId(data[0].id)
      })
      .catch(() => setError("Failed to load utterances."))
  }, [])

  useEffect(() => {
    if (status === "transcribing") endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [segments, status])

  async function startDictation() {
    if (!selectedId || status === "transcribing") return

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setSegments([])
    setTranscriptId(selectedId)
    setShowTranslation(false)
    setTranslationText("")
    setArrivingId(null)
    setError(null)
    setStatus("transcribing")

    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utteranceId: selectedId }),
        signal: ctrl.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      for await (const data of readSSE(res)) {
        if (data === "[DONE]") break
        try {
          const seg = JSON.parse(data) as Segment
          setSegments((prev) => [...prev, seg])
          setArrivingId(seg.id)
        } catch {}
      }

      setArrivingId(null)
      setStatus("ready")
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      setError("Transcription failed. Please try again.")
      setStatus("idle")
    }
  }

  function editSegment(id: string, text: string) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)))
  }

  async function translate() {
    if (!transcriptId || segments.length === 0 || status === "translating") return

    const transcript: Transcript = { id: transcriptId, segments, complete: true }

    setShowTranslation(true)
    setTranslationText("")
    setError(null)
    setStatus("translating")

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, target: targetLang }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      for await (const data of readSSE(res)) {
        if (data === "[DONE]") break
        try {
          const chunk = JSON.parse(data) as string
          setTranslationText((prev) => prev + chunk)
        } catch {}
      }

      setStatus("translated")
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Translation failed. Please try again.")
        setShowTranslation(false)
        setStatus("ready")
      }
    }
  }

  function undoTranslation() {
    setShowTranslation(false)
    setTranslationText("")
    setStatus("ready")
  }

  const hasSegments = segments.length > 0
  const isTranscribing = status === "transcribing"
  const isTranslating = status === "translating"
  const showControls = hasSegments && !isTranscribing

  return (
    <div className="app">
      <div className="app-inner">
        {/* ── Header ── */}
        <header className="app-header">
          <div className="brand">
            <div className="brand-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 12v0" />
                <path d="M8 8v8" />
                <path d="M12 4v16" />
                <path d="M16 8v8" />
                <path d="M20 12v0" />
              </svg>
            </div>
            <span className="brand-name">murmr</span>
          </div>

          <div className="pickers">
            <label className="picker">
              <span className="picker-label">Utterance</span>
              <select
                className="picker-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={isTranscribing}
                aria-label="Select utterance"
              >
                {utterances.map((u) => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
            </label>

            <div className="picker-divider" />

            <label className="picker">
              <span className="picker-label">Target</span>
              <select
                className="picker-select"
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value as LanguageCode)}
                disabled={isTranslating}
                aria-label="Target language"
              >
                {TARGET_LANGS.map((code) => {
                  const m = langMeta(code)
                  return (
                    <option key={code} value={code}>{m.flag} {m.label}</option>
                  )
                })}
              </select>
            </label>
          </div>
        </header>

        {/* ── Error banner ── */}
        {error && (
          <div className="error-banner" role="alert">
            <span aria-hidden="true">⚠</span> {error}
          </div>
        )}

        {/* ── Canvas ── */}
        <section className="canvas">
          <div className="canvas-bar">
            <div className="canvas-bar-left">
              <button
                className={`btn btn-primary${isTranscribing ? " btn-recording" : ""}`}
                onClick={startDictation}
                disabled={isTranscribing || !selectedId}
                aria-busy={isTranscribing}
              >
                {isTranscribing ? (
                  <>
                    <span className="rec-dot" aria-hidden="true" />
                    Recording…
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">🎙</span>
                    {hasSegments ? "Restart" : "Start Dictation"}
                  </>
                )}
              </button>

              {isTranscribing && <span className="status-pill live">● Live</span>}
              {showTranslation && (
                <span className="target-pill">→ {langMeta(targetLang).flag} {langMeta(targetLang).label}</span>
              )}
            </div>

            {showControls && (
              <div className="canvas-bar-right">
                {showTranslation ? (
                  <>
                    <button
                      className="btn btn-ghost"
                      onClick={translate}
                      disabled={isTranslating}
                      title="Re-translate with current edits and language"
                    >
                      {isTranslating ? "Translating…" : "Re-translate"}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={undoTranslation}
                      disabled={isTranslating}
                    >
                      ↩ Undo
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={translate}
                    disabled={isTranslating}
                  >
                    🌐 Normalize &amp; Translate
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="canvas-body">
            {showTranslation ? (
              isTranslating && translationText === "" ? (
                <div className="typing-dots">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              ) : (
                <p className="translation-text">
                  {translationText}
                  {isTranslating && <span className="cursor-blink" aria-hidden="true" />}
                </p>
              )
            ) : hasSegments ? (
              <div
                className="segments-flow"
                role="region"
                aria-label="Transcript segments"
                aria-live="polite"
              >
                {segments.map((seg) => (
                  <SegmentChip
                    key={seg.id}
                    segment={seg}
                    isArriving={seg.id === arrivingId}
                    onEdit={editSegment}
                  />
                ))}
                {isTranscribing && (
                  <span className="typing-dots" aria-label="More segments incoming">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </span>
                )}
                <div ref={endRef} />
              </div>
            ) : isTranscribing ? (
              <div className="typing-dots">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            ) : (
              <div className="empty-state" role="status">
                <div className="empty-icon" aria-hidden="true">🌐</div>
                <p className="empty-title">Ready to listen</p>
                <p className="empty-sub">
                  Pick an utterance and hit <strong>Start Dictation</strong>. Segments stream
                  in as they&apos;re recognized, tagged by language. Click any segment to edit it.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── Language key ── */}
        <LanguageKey />

        <footer className="app-footer">
          Speak your mind, we&apos;ll mind the language.
        </footer>
      </div>
    </div>
  )
}
