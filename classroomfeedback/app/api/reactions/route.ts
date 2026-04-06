import { NextResponse } from "next/server"
import { 
  getTextMessages, 
  addTextMessage, 
  addEmojiReaction,
  clearAll, 
  getClassroomState,
  getReactionCountsSinceReset,
  resetReactionCounts,
  type EmojiReaction
} from "@/lib/store"

// GET - Get all text messages, reaction counts, and class status
export async function GET() {
  const messages = getTextMessages()
  const state = getClassroomState()
  const reactionCounts = getReactionCountsSinceReset()
  
  return NextResponse.json({ 
    messages,
    reactionCounts,
    isActive: state.isActive,
    topic: state.topic
  })
}

// POST - Submit a new reaction (emoji) or text message
export async function POST(request: Request) {
  const state = getClassroomState()
  if (!state.isActive) {
    return NextResponse.json({ error: "Class is not in session" }, { status: 400 })
  }

  try {
    const body = await request.json()

    // Handle emoji reaction
    if (body.type && ["thumbsUp", "thumbsDown", "confused", "lightbulb"].includes(body.type)) {
      addEmojiReaction(body.type as EmojiReaction["type"])
      return NextResponse.json({ success: true, type: "emoji" })
    }

    // Handle text message
    if (body.content) {
      const message = addTextMessage(body.content.trim())
      return NextResponse.json({ success: true, type: "text", message })
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}

// DELETE - Clear all reactions and messages
export async function DELETE() {
  clearAll()
  return NextResponse.json({ success: true })
}

// PATCH - Reset reaction counts (called by teacher on each refresh cycle)
export async function PATCH() {
  resetReactionCounts()
  return NextResponse.json({ success: true })
}

