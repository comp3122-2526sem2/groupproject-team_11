"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { translations, getLanguage, setLanguage, type Language } from "@/lib/i18n"

export default function PortalPage() {
  const [lang, setLang] = useState<Language>("en")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setLang(getLanguage())
    setMounted(true)
  }, [])

  function handleLanguageChange(checked: boolean) {
    const newLang = checked ? "zh-HK" : "en"
    setLang(newLang)
    setLanguage(newLang)
  }

  const t = translations[lang]

  if (!mounted) {
    return (
      <main className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Classroom ShoutBox</CardTitle>
          </CardHeader>
        </Card>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex items-center justify-between">
            <div className="w-16" />
            <CardTitle className="text-2xl">{t.title}</CardTitle>
            <div className="flex w-20 items-center justify-end gap-1">
              <span className={`text-xs ${lang === "en" ? "text-foreground font-medium" : "text-muted-foreground"}`}>A</span>
              <Switch
                checked={lang === "zh-HK"}
                onCheckedChange={handleLanguageChange}
              />
              <span className={`text-xs ${lang === "zh-HK" ? "text-foreground font-medium" : "text-muted-foreground"}`}>中</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button asChild className="h-14 text-lg">
            <Link href="/teacher">{t.imTeacher}</Link>
          </Button>
          <Button asChild variant="outline" className="h-14 text-lg">
            <Link href="/student">{t.imStudent}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
