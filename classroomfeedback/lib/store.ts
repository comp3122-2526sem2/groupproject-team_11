// In-memory store for classroom state

// Emoji reactions (clicks, not texts)
export interface EmojiReaction {
  type: "thumbsUp" | "thumbsDown" | "confused" | "lightbulb"
  timestamp: Date
}

// Text messages from students
export interface TextMessage {
  id: string
  content: string
  timestamp: Date
}

export interface Summary {
  content: string
  lastUpdated: Date
  messageCount: number // To detect when re-summarization is needed
}

// Reaction counts since last refresh (for teacher display)
export interface ReactionCounts {
  thumbsUp: number
  thumbsDown: number
  confused: number
  lightbulb: number
}

export interface ClassroomState {
  topic: string
  isActive: boolean
  emojiReactions: EmojiReaction[]
  textMessages: TextMessage[]
  lastSummary: Summary | null
  lastReactionCountReset: Date
}

// Single classroom state (in-memory, resets on server restart)
const classroomState: ClassroomState = {
  topic: "",
  isActive: false,
  emojiReactions: [],
  textMessages: [],
  lastSummary: null,
  lastReactionCountReset: new Date(),
}

// Getters
export function getClassroomState(): ClassroomState {
  return classroomState
}

export function getTextMessages(): TextMessage[] {
  return classroomState.textMessages
}

export function getLastSummary(): Summary | null {
  return classroomState.lastSummary
}

// Get reaction counts since last reset
export function getReactionCountsSinceReset(): ReactionCounts {
  const counts: ReactionCounts = {
    thumbsUp: 0,
    thumbsDown: 0,
    confused: 0,
    lightbulb: 0,
  }
  
  for (const reaction of classroomState.emojiReactions) {
    if (reaction.timestamp >= classroomState.lastReactionCountReset) {
      counts[reaction.type]++
    }
  }
  
  return counts
}

// Reset the reaction count timer
export function resetReactionCounts(): void {
  classroomState.lastReactionCountReset = new Date()
}

// Setters
export function setTopic(topic: string): void {
  classroomState.topic = topic
}

export function setIsActive(isActive: boolean): void {
  classroomState.isActive = isActive
}

export function addEmojiReaction(type: EmojiReaction["type"]): void {
  classroomState.emojiReactions.push({
    type,
    timestamp: new Date(),
  })
}

export function addTextMessage(content: string): TextMessage {
  const message: TextMessage = {
    id: crypto.randomUUID(),
    content,
    timestamp: new Date(),
  }
  classroomState.textMessages.push(message)
  return message
}

export function clearAll(): void {
  classroomState.emojiReactions = []
  classroomState.textMessages = []
  classroomState.lastSummary = null
  classroomState.lastReactionCountReset = new Date()
}

export function setSummary(content: string, messageCount: number): void {
  classroomState.lastSummary = {
    content,
    lastUpdated: new Date(),
    messageCount,
  }
}

// Check if we need to re-summarize (only based on text messages)
export function needsResummarization(): boolean {
  if (!classroomState.lastSummary) {
    return classroomState.textMessages.length > 0
  }
  return classroomState.textMessages.length > classroomState.lastSummary.messageCount
}
