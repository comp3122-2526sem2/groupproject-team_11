export type Language = "en" | "zh-HK"

export const translations = {
  en: {
    // Portal
    title: "Classroom ShoutBox",
    imTeacher: "I'm a Teacher",
    imStudent: "I'm a Student",
    
    // Student page
    student: "Student",
    back: "Back",
    loading: "Loading...",
    classNotInSession: "Class is not in session",
    waitForTeacher: "Wait for the teacher to start the class",
    quickReactions: "Quick Reactions",
    sent: "Sent!",
    wait: "Wait",
    sendMessage: "Send a Message",
    typePlaceholder: "Type your question or comment...",
    sending: "Sending...",
    send: "Send",
    messageSent: "Message sent!",
    
    // Teacher page
    teacherDashboard: "Teacher Dashboard",
    classInSession: "Class in session",
    classNotActive: "Class not active",
    endSession: "End Session",
    startSession: "Start Session",
    aiSummary: "AI Summary",
    refresh: "Refresh",
    startSessionToSee: "Start the session to see AI summary",
    generatingSummary: "Generating summary...",
    studentMessages: "Student Messages",
    noMessagesYet: "No messages yet",
  },
  "zh-HK": {
    // Portal
    title: "課室留言箱",
    imTeacher: "我係老師",
    imStudent: "我係學生",
    
    // Student page
    student: "學生",
    back: "返回",
    loading: "載入中...",
    classNotInSession: "課堂未開始",
    waitForTeacher: "請等待老師開始課堂",
    quickReactions: "快速反應",
    sent: "已傳送！",
    wait: "等待",
    sendMessage: "傳送訊息",
    typePlaceholder: "輸入你嘅問題或意見...",
    sending: "傳送中...",
    send: "傳送",
    messageSent: "訊息已傳送！",
    
    // Teacher page
    teacherDashboard: "老師控制台",
    classInSession: "課堂進行中",
    classNotActive: "課堂未開始",
    endSession: "結束課堂",
    startSession: "開始課堂",
    aiSummary: "AI 摘要",
    refresh: "重新整理",
    startSessionToSee: "開始課堂以查看 AI 摘要",
    generatingSummary: "正在生成摘要...",
    studentMessages: "學生訊息",
    noMessagesYet: "暫無訊息",
  },
}

export function getLanguage(): Language {
  if (typeof window === "undefined") return "en"
  return (localStorage.getItem("language") as Language) || "en"
}

export function setLanguage(lang: Language): void {
  if (typeof window === "undefined") return
  localStorage.setItem("language", lang)
}

export function t(key: keyof typeof translations.en, lang?: Language): string {
  const currentLang = lang || getLanguage()
  return translations[currentLang][key] || translations.en[key]
}
