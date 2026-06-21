import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Murmr",
  description: "Voice transcription that preserves code-switching",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
