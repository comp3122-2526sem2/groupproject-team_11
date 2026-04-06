"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { config } from "@/lib/config"
import { translations, getLanguage, type Language } from "@/lib/i18n"

const EMOJI_REACTIONS = [
  { type: "thumbsUp", icon: "👍" },
  { type: "thumbsDown", icon: "👎" },
  { type: "confused", icon: "😕" },
  { type: "lightbulb", icon: "💡" },
] as const

export default function StudentPage() {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [reactionSent, setReactionSent] = useState<string | null>(null)
  const [isSendingReaction, setIsSendingReaction] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [lang, setLang] = useState<Language>("en")

  const maxLength = config.maxMessageLength
  const cooldownSeconds = config.messageCooldown
  const isOverLimit = message.length > maxLength
  const isOnCooldown = cooldownRemaining > 0

  const t = translations[lang]

  // Load language preference
  useEffect(() => {
    setLang(getLanguage())
  }, [])

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return
    const timer = setTimeout(() => {
      setCooldownRemaining((prev) => prev - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [cooldownRemaining])

  // Check class status
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/reactions")
      if (res.ok) {
        const data = await res.json()
        setIsActive(data.isActive)
      }
    } catch {
      // Ignore errors
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial load and polling
  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, config.refreshTime * 1000)
    return () => clearInterval(interval)
  }, [checkStatus])

  async function handleEmojiReaction(type: string, icon: string) {
    if (isOnCooldown || isSendingReaction) return
    setIsSendingReaction(true)
    try {
      await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
      setReactionSent(icon)
      setCooldownRemaining(cooldownSeconds)
      setTimeout(() => setReactionSent(null), 1500)
    } catch {
      // Ignore errors
    } finally {
      setIsSendingReaction(false)
    }
  }

  async function handleSubmitMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || isSubmitting || isOverLimit || isOnCooldown) return

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      })

      if (res.ok) {
        setMessage("")
        setShowSuccess(true)
        setCooldownRemaining(cooldownSeconds)
        setTimeout(() => setShowSuccess(false), 2000)
      }
    } catch {
      // Ignore errors
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleBack() {
    router.push("/")
  }

  if (isLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center p-4">
        <p className="text-muted-foreground">{t.loading}</p>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-semibold">{t.student}</h1>
        <Button variant="outline" size="sm" onClick={handleBack}>
          {t.back}
        </Button>
      </header>

      {/* Main content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
        {!isActive ? (
          <div className="text-center">
            <p className="text-lg text-muted-foreground">
              {t.classNotInSession}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.waitForTeacher}
            </p>
          </div>
        ) : (
          <>
            {/* Emoji Reactions */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">{t.quickReactions}</p>
              <div className="flex gap-2">
                {EMOJI_REACTIONS.map((reaction) => (
                  <button
                    key={reaction.type}
                    onClick={() => handleEmojiReaction(reaction.type, reaction.icon)}
                    disabled={isOnCooldown || isSendingReaction}
                    className={`text-4xl transition-transform ${isOnCooldown || isSendingReaction ? "opacity-40 cursor-not-allowed" : "hover:scale-110 active:scale-95"}`}
                  >
                    {reaction.icon}
                  </button>
                ))}
              </div>
              {reactionSent && (
                <p className="text-sm text-green-600">
                  {reactionSent} {t.sent}
                </p>
              )}
              {isOnCooldown && !reactionSent && (
                <p className="text-sm text-muted-foreground">
                  {t.wait} {cooldownRemaining}s
                </p>
              )}
            </div>

            {/* Text Message */}
            <Card className="w-full max-w-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-center text-base">
                  {t.sendMessage}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitMessage} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <Input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={t.typePlaceholder}
                      autoComplete="off"
                      className={`h-12 text-base ${isOverLimit ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                      maxLength={maxLength + 50}
                    />
                    <div className="flex justify-end">
                      <span className={`text-xs ${isOverLimit ? "text-red-500" : "text-muted-foreground"}`}>
                        {message.length}/{maxLength}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="h-12 text-base"
                    disabled={!message.trim() || isSubmitting || isOverLimit || isOnCooldown}
                  >
                    {isSubmitting
                      ? t.sending
                      : isOnCooldown
                        ? `${t.wait} ${cooldownRemaining}s`
                        : t.send}
                  </Button>
                  {showSuccess && (
                    <p className="text-center text-sm text-green-600">
                      {t.messageSent}
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  )
}
