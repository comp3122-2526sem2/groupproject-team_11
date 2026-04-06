// Central configuration for the classroom reaction app
// NEXT_PUBLIC_* env vars are inlined at build time by Next.js

export const config = {
  // Polling interval in seconds (client-side)
  refreshTime: 20,
  // Maximum message length in characters (default: 200)
  maxMessageLength: Number(process.env.NEXT_PUBLIC_MAX_MESSAGE_LENGTH) || 200,
  // Cooldown between messages in seconds (default: 20)
  messageCooldown: Number(process.env.NEXT_PUBLIC_MESSAGE_COOLDOWN) || 20,
}
