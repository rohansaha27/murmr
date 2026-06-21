import { NextRequest } from "next/server"
import { translate } from "../../../llm_stub"
import type { Transcript, LanguageCode } from "../../../types"

export async function POST(req: NextRequest) {
  const { transcript, target } = (await req.json()) as { transcript: Transcript; target: LanguageCode }
  const stream = translate(transcript, target)

  const readable = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      try {
        for await (const chunk of stream.chunks) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(chunk)}\n\n`))
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
