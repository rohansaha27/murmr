"use client"

import { useState, useEffect, useRef } from "react"
import type { Segment, Transcript, LanguageCode } from "../types"

// ── Language metadata ────────────────────────────────────────────────────────

type LangMeta = { label: string; bg: string; text: string; dot: string }

const LANG_META: Record<string, LangMeta> = {
  en: { label: "EN", bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6" },
  zh: { label: "ZH", bg: "#fef2f2", text: "#b91c1c", dot: "#ef4444" },
  es: { label: "ES", bg: "#fffbeb", text: "#b45309", dot: "#f59e0b" },
  hi: { label: "HI", bg: "#f5f3ff", text: "#6d28d9", dot: "#8b5cf6" },
  fr: { label: "FR", bg: "#ecfdf5", text: "#047857", dot: "#10b981" },
  ja: { label: "JA", bg: "#fdf2f8", text: "#be185d", dot: "#ec4899" },
  ko: { label: "KO", bg: "#eef2ff", text: "#3730a3", dot: "#6366f1" },
  pt: { label: "PT", bg: "#f0fdfa", text: "#0f766e", dot: "#14b8a6" },
  ar: { label: "AR", bg: "#fff7ed", text: "#c2410c", dot: "#f97316" },
}

function langMeta(lang: string): LangMeta {
  return LANG_META[lang] ?? { label: lang.toUpperCase(), bg: "#f8fafc", text: "#475569", dot: "#94a3b8" }
}

const TARGET_LANGS: { code: LanguageCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文 (Mandarin)" },
  { code: "es", label: "Español" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "fr", label: "Français" },
]

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

  // Sync draft when parent updates segment text (after save)
  useEffect(() => {
    if (!editing) setDraft(segment.text)
  }, [segment.text, editing])

  // Auto-focus when entering edit mode
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
    // Resize input to content width
    if (inputRef.current) {
      inputRef.current.style.width = `${Math.max(2, v.length)}ch`
    }
  }

  return (
    <span
      className={`seg-chip${isArriving ? " seg-chip-arriving" : ""}`}
      style={{
        "--chip-bg": m.bg,
        "--chip-text": m.text,
        "--chip-dot": m.dot,
      } as React.CSSProperties}
      title={`Language: ${segment.lang} — click text to edit`}
    >
      <span className="lang-tag">{m.label}</span>
      {editing ? (
        <input
          ref={inputRef}
          className="seg-edit-input"
          value={draft}
          onChange={onInputChange}
          onBlur={save}
          onKeyDown={onKeyDown}
          style={{ width: `${Math.max(2, draft.length)}ch` }}
          aria-label={`Edit ${segment.lang} segment`}
        />
      ) : (
        <span
          className="seg-text"
          onClick={startEdit}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && startEdit()}
          aria-label={`${segment.lang}: ${segment.text}. Click to edit.`}
        >
          {segment.text}
        </span>
      )}
    </span>
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

  // Load utterance list on mount
  useEffect(() => {
    fetch("/api/utterances")
      .then((r) => r.json())
      .then((data: { id: string; label: string }[]) => {
        setUtterances(data)
        if (data.length > 0) setSelectedId(data[0].id)
      })
      .catch(() => setError("Failed to load utterances."))
  }, [])

  // Scroll new segments into view
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
      <header className="app-header">
        <div className="logo">murmr</div>
        <div className="header-divider" />
        <p className="tagline">Voice flow for code-switching speakers</p>
      </header>

      <main className="app-main">
        {/* ── Error banner ── */}
        {error && (
          <div className="error-banner" role="alert">
            <span>⚠</span> {error}
          </div>
        )}

        {/* ── Session card ── */}
        <div className="card">
          <div className="card-body">
            <div className="session-controls">
              <select
                className="utterance-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={isTranscribing}
                aria-label="Select utterance"
              >
                {utterances.map((u) => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>

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
                    Start Dictation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Transcript / Translation card ── */}
        {hasSegments && (
          <div className="card">
            <div className="card-header">
              <span className="card-label">
                {showTranslation ? "Translation" : "Transcript"}
              </span>
              {showTranslation && (
                <span className="translation-target-pill">
                  → {TARGET_LANGS.find((l) => l.code === targetLang)?.label}
                </span>
              )}
              {isTranscribing && (
                <span className="card-label" style={{ color: "#ef4444" }}>
                  ● Live
                </span>
              )}
            </div>

            <div className="card-body">
              {showTranslation ? (
                /* ── Translation text view ── */
                <div className="translation-body">
                  {isTranslating && translationText === "" ? (
                    <div className="typing-dots" style={{ padding: "0.25rem 0" }}>
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  ) : (
                    <p className="translation-text">
                      {translationText}
                      {isTranslating && (
                        <span className="cursor-blink" aria-hidden="true">|</span>
                      )}
                    </p>
                  )}
                </div>
              ) : (
                /* ── Segment chips view ── */
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
              )}
            </div>

            {/* ── Translation controls bar ── */}
            {showControls && (
              <div className="translation-bar">
                <span className="translation-bar-label">Translate to</span>
                <select
                  className="lang-select"
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value as LanguageCode)}
                  disabled={isTranslating}
                  aria-label="Target language"
                >
                  {TARGET_LANGS.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>

                <span className="bar-spacer" />

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
                      ↩ Undo Translation
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={translate}
                    disabled={isTranslating || isTranscribing}
                  >
                    Translate
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Waiting for first segment ── */}
        {isTranscribing && !hasSegments && (
          <div className="card">
            <div className="card-body">
              <div className="typing-dots" style={{ padding: "0.5rem 0" }}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!hasSegments && !isTranscribing && (
          <div className="empty-state" role="status">
            <div className="empty-icon" aria-hidden="true">🌐</div>
            <p className="empty-title">Ready to listen</p>
            <p className="empty-sub">
              Pick an utterance above and click <strong>Start Dictation</strong>.
              Segments will stream in as they're recognized, tagged by language.
            </p>
            <div className="empty-chips" aria-label="Supported languages">
              {(["en", "zh", "es", "hi", "fr"] as const).map((code) => {
                const m = langMeta(code)
                return (
                  <span
                    key={code}
                    className="empty-chip"
                    style={{ background: m.bg, color: m.text }}
                  >
                    {m.label}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
