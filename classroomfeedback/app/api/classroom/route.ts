import { NextResponse } from "next/server"
import { getClassroomState, setTopic, setIsActive } from "@/lib/store"

// GET - Get classroom state
export async function GET() {
  const state = getClassroomState()
  return NextResponse.json({
    topic: state.topic,
    isActive: state.isActive,
  })
}

// PATCH - Update classroom state
export async function PATCH(request: Request) {
  try {
    const body = await request.json()

    if (typeof body.topic === "string") {
      setTopic(body.topic)
    }

    if (typeof body.isActive === "boolean") {
      setIsActive(body.isActive)
    }

    const state = getClassroomState()
    return NextResponse.json({
      topic: state.topic,
      isActive: state.isActive,
    })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
