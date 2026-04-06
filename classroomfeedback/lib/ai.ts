import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

// Configuration via environment variables
// OPENAI_API_KEY - Your OpenAI API key (required)
// OPENAI_MODEL - Model to use (default: gpt-4o-mini)
// OPENAI_BASE_URL - API endpoint (default: https://api.openai.com/v1)

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
})

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"

// Generate AI summary of student reactions
export async function generateSummary(
  topic: string,
  messages: string[],
  language: string = "en"
): Promise<string> {
  if (messages.length === 0) {
    return language === "zh-HK" ? "暫無學生訊息。" : "No student submissions yet."
  }

  const langPrefix = language === "zh-HK" 
    ? "Using Hong Kong Style Traditional Chinese, " 
    : ""

  const prompt = `${langPrefix}Summarize these student messages from a live class in one to two sentences. No markdown, no bullet points, no headers. Just plain text. Focus on the main themes or concerns. If you see gibberish or uselss input, only summarise those meaningful ones.

Messages:
${messages.join("\n")}

Summary:`

  const result = await generateText({
    model: openai(MODEL),
    prompt,
  })

  return result.text
}
