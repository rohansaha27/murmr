import { NextResponse } from "next/server"
import { listUtterances } from "../../../stt_stub"

export async function GET() {
  return NextResponse.json(listUtterances())
}
