import { NextRequest, NextResponse } from "next/server"
import { translate } from "../../../llm_stub"
import type { Transcript, LanguageCode } from "../../../types"

export async function POST(req: NextRequest) {
  let transcript: Transcript | undefined
  let target: LanguageCode | undefined
  try {
    ({ transcript, target } = (await req.json()) as { transcript: Transcript; target: LanguageCode })
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!transcript || !Array.isArray(transcript.segments) || typeof target !== "string") {
    return NextResponse.json({ error: "Missing or invalid transcript/target" }, { status: 400 })
  }

  let stream
  try {
    stream = translate(transcript, target)
  } catch {
    return NextResponse.json({ error: "Translation failed to start" }, { status: 500 })
  }

  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      try {
        for await (const chunk of stream.chunks) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(chunk)}\n\n`))
        }
        controller.enqueue(enc.encode(`data: [DONE]\n\n`))
      } catch {
        // LLM failed mid-stream: close cleanly so the client stops reading.
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
