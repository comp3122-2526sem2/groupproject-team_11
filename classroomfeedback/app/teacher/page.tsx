"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { config } from "@/lib/config"
import { translations, getLanguage, type Language } from "@/lib/i18n"

interface TextMessage {
  id: string
  content: string
  timestamp: string
}

interface ReactionCounts {
  thumbsUp: number
  thumbsDown: number
  confused: number
  lightbulb: number
}

const EMOJI_MAP = {
  thumbsUp: { icon: "👍" },
  thumbsDown: { icon: "👎" },
  confused: { icon: "😕" },
  lightbulb: { icon: "💡" },
}

export default function TeacherPage() {
  const router = useRouter()
  const [isActive, setIsActive] = useState(false)
  const [messages, setMessages] = useState<TextMessage[]>([])
  const [reactionCounts, setReactionCounts] = useState<ReactionCounts>({
    thumbsUp: 0,
    thumbsDown: 0,
    confused: 0,
    lightbulb: 0,
  })
  const [summary, setSummary] = useState("")
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [lang, setLang] = useState<Language>("en")

  const t = translations[lang]

  // Load language preference
  useEffect(() => {
    setLang(getLanguage())
  }, [])

  // Fetch classroom state, messages, and reaction counts
  const fetchData = useCallback(async () => {
    try {
      const [classroomRes, reactionsRes] = await Promise.all([
        fetch("/api/classroom"),
        fetch("/api/reactions"),
      ])

      if (classroomRes.ok) {
        const data = await classroomRes.json()
        setIsActive(data.isActive)
      }

      if (reactionsRes.ok) {
        const data = await reactionsRes.json()
        setMessages(data.messages)
        setReactionCounts(data.reactionCounts)
      }
    } catch {
      // Ignore errors
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch summary - passes language to API
  const fetchSummary = useCallback(async () => {
    if (!isActive) return
    
    setSummaryLoading(true)
    try {
      const res = await fetch(`/api/summary?lang=${lang}`)
      if (res.ok) {
        const data = await res.json()
        setSummary(data.summary)
      }
    } catch {
      // Ignore errors
    } finally {
      setSummaryLoading(false)
    }
  }, [isActive, lang])

  // Reset reaction counts after reading them
  const resetReactionCounts = useCallback(async () => {
    try {
      await fetch("/api/reactions", { method: "PATCH" })
    } catch {
      // Ignore errors
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Polling for data - fetch, then reset reaction counts
  useEffect(() => {
    const interval = setInterval(async () => {
      await fetchData()
      await fetchSummary()
      await resetReactionCounts()
    }, config.refreshTime * 1000)
    return () => clearInterval(interval)
  }, [fetchData, fetchSummary, resetReactionCounts])

  // Fetch summary when session becomes active
  useEffect(() => {
    if (isActive) {
      fetchSummary()
    }
  }, [isActive, fetchSummary])

  async function handleToggleSession() {
    const newState = !isActive
    try {
      const res = await fetch("/api/classroom", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newState }),
      })
      if (res.ok) {
        setIsActive(newState)
        if (newState) {
          fetchSummary()
        }
      }
    } catch {
      // Ignore errors
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
        <h1 className="text-lg font-semibold">{t.teacherDashboard}</h1>
        <Button variant="outline" size="sm" onClick={handleBack}>
          {t.back}
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
        {/* Controls */}
        <div className="flex items-center justify-between rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${isActive ? "bg-green-500" : "bg-muted"}`} />
            <span className="font-medium">
              {isActive ? t.classInSession : t.classNotActive}
            </span>
          </div>
          <Button
            onClick={handleToggleSession}
            variant={isActive ? "destructive" : "default"}
            size="sm"
          >
            {isActive ? t.endSession : t.startSession}
          </Button>
        </div>

        {/* Reaction Counts */}
        <div className="flex items-center gap-6">
          {(Object.entries(EMOJI_MAP) as [keyof ReactionCounts, typeof EMOJI_MAP.thumbsUp][]).map(
            ([key, { icon }]) => {
              const count = reactionCounts[key]
              return (
                <span
                  key={key}
                  className={`flex items-center gap-1 ${count === 0 ? "opacity-20" : ""}`}
                >
                  <span className="text-4xl">{icon}</span>
                  {count > 0 && (
                    <span className="text-xl font-semibold">
                      {count > 99 ? "💥" : count}
                    </span>
                  )}
                </span>
              )
            }
          )}
        </div>

        {/* AI Summary */}
        <Card className="flex-1">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">{t.aiSummary}</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchSummary}
              disabled={summaryLoading || !isActive}
            >
              {summaryLoading ? t.loading : t.refresh}
            </Button>
          </CardHeader>
          <CardContent>
            {!isActive ? (
              <p className="text-muted-foreground">
                {t.startSessionToSee}
              </p>
            ) : messages.length === 0 ? (
              <p className="text-muted-foreground">{t.noMessagesYet}</p>
            ) : summaryLoading && !summary ? (
              <p className="text-muted-foreground">{t.generatingSummary}</p>
            ) : (
              <div className="whitespace-pre-wrap text-sm">{summary}</div>
            )}
          </CardContent>
        </Card>

        {/* Text Messages Feed */}
        <div>
          <h2 className="mb-2 text-base font-semibold">
            {t.studentMessages} ({messages.length})
          </h2>
          {messages.length === 0 ? (
            <p className="text-muted-foreground">{t.noMessagesYet}</p>
          ) : (
            <div className="flex max-h-[15vh] flex-col gap-2 overflow-y-auto">
              {messages
                .slice()
                .reverse()
                .map((msg) => (
                  <div
                    key={msg.id}
                    className="flex items-start justify-between gap-2 rounded border bg-muted/50 px-2 py-1"
                  >
                    <p className="min-w-0 break-words text-sm">{msg.content}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
