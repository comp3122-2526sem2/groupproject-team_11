import { NextResponse } from "next/server"
import { 
  getClassroomState, 
  getTextMessages, 
  getLastSummary, 
  needsResummarization,
  setSummary 
} from "@/lib/store"
import { generateSummary } from "@/lib/ai"

// GET - Get AI summary (only summarizes text messages, not emoji reactions)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lang = searchParams.get("lang") || "en"
  
  const state = getClassroomState()
  const messages = getTextMessages()
  const lastSummary = getLastSummary()

  // Check if we need to regenerate summary
  if (needsResummarization()) {
    try {
      // Extract just the message content
      const messageContents = messages.map((m) => m.content)
      const summaryContent = await generateSummary(state.topic, messageContents, lang)
      setSummary(summaryContent, messages.length)
      
      return NextResponse.json({
        summary: summaryContent,
        lastUpdated: new Date(),
        messageCount: messages.length,
      })
    } catch (error) {
      console.error("Summary generation failed:", error)
      return NextResponse.json({
        summary: lastSummary?.content || "Failed to generate summary",
        lastUpdated: lastSummary?.lastUpdated || null,
        messageCount: messages.length,
        error: "Summary generation failed",
      })
    }
  }

  // Return cached summary
  return NextResponse.json({
    summary: lastSummary?.content || "No student submissions yet.",
    lastUpdated: lastSummary?.lastUpdated || null,
    messageCount: messages.length,
  })
}
