import { NextRequest } from "next/server"
import { transcribe } from "../../../stt_stub"

export async function POST(req: NextRequest) {
  const { utteranceId } = await req.json()
  const stream = transcribe(utteranceId)

  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      try {
        for await (const segment of stream.segments) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(segment)}\n\n`))
        }
        controller.enqueue(enc.encode(`data: [DONE]\n\n`))
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
