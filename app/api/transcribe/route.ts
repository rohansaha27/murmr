import { NextRequest, NextResponse } from "next/server"
import { transcribe } from "../../../stt_stub"

export async function POST(req: NextRequest) {
  let utteranceId: unknown
  try {
    ({ utteranceId } = await req.json())
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (typeof utteranceId !== "string" || utteranceId.length === 0) {
    return NextResponse.json({ error: "Missing or invalid utteranceId" }, { status: 400 })
  }

  let stream
  try {
    stream = transcribe(utteranceId)
  } catch {
    return NextResponse.json({ error: `Unknown utterance: ${utteranceId}` }, { status: 404 })
  }

  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      try {
        for await (const segment of stream.segments) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(segment)}\n\n`))
        }
        controller.enqueue(enc.encode(`data: [DONE]\n\n`))
      } catch {
        // STT failed mid-stream: close cleanly so the client stops reading.
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
