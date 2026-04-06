/**
 * i18n.js — Global Internationalization Module
 * Provides Chinese (Traditional) ↔ English language switching.
 * Must be loaded BEFORE auth-guard.js and page-specific scripts.
 *
 * API:
 *   i18n.getLang()         → 'zh' | 'en'
 *   i18n.setLang(lang)     → set language, persist, re-render DOM
 *   i18n.t(key)            → get translated string
 *   i18n.applyAll()        → scan DOM and replace data-i18n text
 *   i18n.onLangChange(cb)  → register callback for language change
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'mathHub.language';
    const SUPPORTED = ['zh', 'en'];
    const DEFAULT_LANG = 'zh';

    // ══════════════════════════════════════════════════════════
    //  TRANSLATION DICTIONARIES
    // ══════════════════════════════════════════════════════════
    const TRANSLATIONS = {
        // ─────────────────────────────────────────────
        //  SHARED: Sidebar, Topbar, Auth, Language
        // ─────────────────────────────────────────────
        // Sidebar
        'nav.learningModules':      { zh: '學習模組',                en: 'Learning Modules' },
        'nav.interactiveMath':      { zh: '互動數學視覺化',           en: 'Interactive Math Visualisation' },
        'nav.aiSolver':             { zh: 'AI Math Solver',         en: 'AI Math Solver' },
        'nav.aiPlanner':            { zh: 'AI Learning Planner',    en: 'AI Learning Planner' },
        'nav.geometryGen':          { zh: '動態幾何生成器',           en: 'Geometry Generator' },
        'nav.algebraGen':           { zh: '代數問題生成器',           en: 'Algebra Generator' },
        'nav.management':           { zh: '管理',                   en: 'Management' },
        'nav.myProblems':           { zh: '我的題庫',               en: 'My Problems' },
        'nav.comingSoon':           { zh: '即將推出',               en: 'Coming Soon' },
        'nav.onlineClassroom':      { zh: '在線課堂',               en: 'Online Classroom' },
        'sidebar.brandSub':         { zh: 'Education Platform',    en: 'Education Platform' },

        // Auth
        'auth.welcome':             { zh: '歡迎來到 Math Hub',      en: 'Welcome to Math Hub' },
        'auth.description':         { zh: '請輸入你的學號以開始使用平台', en: 'Enter your Student ID to start using the platform' },
        'auth.studentId':           { zh: '學號 Student ID',        en: 'Student ID' },
        'auth.placeholder':         { zh: '例如：23456789',         en: 'e.g. 23456789' },
        'auth.enter':               { zh: '進入平台',               en: 'Enter Platform' },
        'auth.note':                { zh: '⚠️ 無需密碼 — 任何人都可使用你的學號登入查看你的紀錄。', en: '⚠️ No password required — anyone can log in with your Student ID to view your records.' },
        'auth.inputHint.empty':     { zh: '請輸入學號',             en: 'Please enter your Student ID' },
        'auth.inputHint.invalid':   { zh: '學號只可包含英文、數字、_、-（3-30 個字元）', en: 'Student ID can only contain letters, digits, _, - (3-30 characters)' },
        'auth.idLabel':             { zh: '學號',                   en: 'Student ID' },
        'auth.logout':              { zh: '↪ 登出',                en: '↪ Logout' },
        'auth.logoutConfirm':       { zh: '確定要登出嗎？登出後需重新輸入學號。', en: 'Are you sure you want to log out? You will need to re-enter your Student ID.' },
        'auth.inputTitle':          { zh: '請輸入英文字母、數字、底線或連字號', en: 'Please enter letters, digits, underscores or hyphens' },

        // Language toggle
        'lang.zh':                  { zh: '繁體中文',               en: '繁體中文' },
        'lang.en':                  { zh: 'English',               en: 'English' },

        // ─────────────────────────────────────────────
        //  INDEX PAGE (Home)
        // ─────────────────────────────────────────────
        'home.title':               { zh: 'Math Exploration Hub — 互動式數學教育平台', en: 'Math Exploration Hub — Interactive Math Education Platform' },
        'home.meta':                { zh: '透過互動視覺化、AI 數學求解器與智能學習規劃，以全新方式理解數學概念。', en: 'Understand math concepts in a new way through interactive visualisation, AI math solver and smart learning planner.' },
        'home.breadcrumb':          { zh: '互動數學視覺化',          en: 'Interactive Math Visualisation' },
        'home.heroEyebrow':         { zh: '互動式數學學習平台',       en: 'Interactive Math Learning Platform' },
        'home.heroTitle1':          { zh: '透過',                   en: 'See the beauty of math' },
        'home.heroAccent':          { zh: '視覺化',                 en: 'through visualisation' },
        'home.heroTitle2':          { zh: '，\n看見數學之美',         en: '' },
        'home.heroDesc':            { zh: '跟著動態圖形一起探索幾何、概率、代數背後的數學直覺——\n搭配 AI 求解器與智能學習規劃，讓每一次學習都更高效。', en: 'Explore the mathematical intuition behind geometry, probability and algebra with dynamic graphics — paired with AI solver and smart learning planner for more efficient learning.' },
        'home.badgeViz':            { zh: '互動視覺化',              en: 'Interactive Viz' },
        'home.badgeClassroom':      { zh: '在線課堂（即將推出）',      en: 'Online Classroom (Coming Soon)' },

        // Categories
        'home.catGeometry':         { zh: '幾何與測量',              en: 'Geometry & Measurement' },
        'home.catGeometrySub':      { zh: 'Geometry & Measurement', en: 'Geometry & Measurement' },
        'home.catProbability':      { zh: '概率與統計',              en: 'Probability & Statistics' },
        'home.catProbabilitySub':   { zh: 'Probability & Statistics', en: 'Probability & Statistics' },
        'home.catAlgebra':          { zh: '數與代數',                en: 'Numbers & Algebra' },
        'home.catAlgebraSub':       { zh: 'Numbers & Algebra',     en: 'Numbers & Algebra' },

        // Cards
        'home.circleTitle':         { zh: '圓形面積',               en: 'Circle Area' },
        'home.circleDesc':          { zh: '透過將圓形切片展開並重新組合，視覺化體驗這個最經典的從圓到長方形的數學轉換過程。', en: 'Visualise the classic mathematical transformation from circle to rectangle by slicing and rearranging.' },
        'home.cylinderTitle':       { zh: '圓柱側表面積',            en: 'Cylinder Lateral Surface Area' },
        'home.cylinderDesc':        { zh: '將立體的圓柱沿著側面剪開攤平，你會發現原本彎曲的表面原來只是一個簡單的長方形。', en: 'Cut open a cylinder along its side and unfold it — you\'ll discover the curved surface is just a simple rectangle.' },
        'home.pythagorasTitle':     { zh: '畢氏定理',               en: 'Pythagorean Theorem' },
        'home.pythagorasDesc':      { zh: '透過面積拼湊法和倒水實驗，親眼見證直角三角形三邊的神奇關係。', en: 'Witness the magical relationship of a right triangle\'s three sides through area puzzles and water-pouring experiments.' },
        'home.probabilityTitle':    { zh: '大數法則',               en: 'Law of Large Numbers' },
        'home.probabilityDesc':     { zh: '擲硬幣時，正面比例一開始會大幅震盪，但隨著次數增加，曲線會肉眼可見地收斂到 0.5。親手體驗隨機性中的規律！', en: 'When flipping coins, the proportion of heads oscillates wildly at first, but visibly converges to 0.5 as you increase the count. Experience the pattern within randomness!' },
        'home.sqrt2Title':          { zh: '無理數 √2',             en: 'Irrational Number √2' },
        'home.sqrt2Desc':           { zh: '在數線上用圓規作圖精確標出 √2，並透過無限放大，親眼看見無理數確實存在！', en: 'Use a compass to precisely locate √2 on the number line, and zoom in infinitely to see that irrational numbers truly exist!' },
        'home.expTitle':            { zh: '指數增長 vs 線性增長',     en: 'Exponential vs Linear Growth' },
        'home.expDesc':             { zh: '在 8×8 棋盤上放米粒，每格翻倍。親眼見證指數增長如何令線性增長完全消失，理解複利與病毒傳播的數學直覺。', en: 'Place rice grains on an 8×8 chessboard, doubling each square. Witness how exponential growth makes linear growth vanish entirely.' },
        'home.calculusTitle':       { zh: '微積分基礎',              en: 'Calculus Basics' },
        'home.calculusDesc':        { zh: '體驗極限與無窮分割的概念，看著曲線下的面積如何被精確計算。', en: 'Experience the concepts of limits and infinite division, watching how the area under a curve is precisely calculated.' },
        'home.explore':             { zh: '開始探索',               en: 'Explore' },
        'home.inDev':               { zh: '🔒 開發中',             en: '🔒 In Development' },

        // Topbar buttons
        'topbar.aiSolver':          { zh: '🤖 AI Solver',          en: '🤖 AI Solver' },
        'topbar.planner':           { zh: '🗂️ Learning Planner',   en: '🗂️ Learning Planner' },

        // ─────────────────────────────────────────────
        //  PROBLEM SOLVER
        // ─────────────────────────────────────────────
        'solver.title':             { zh: '📚 AI Math Problem Solver', en: '📚 AI Math Problem Solver' },
        'solver.desc':              { zh: '輸入你的數學題目，讓 AI 一步步引導你解題。', en: 'Enter your math problem and let AI guide you step by step.' },
        'solver.back':              { zh: '← 返回首頁',             en: '← Back to Home' },
        'solver.enterProblem':      { zh: '📝 輸入題目',            en: '📝 Enter Problem' },
        'solver.placeholder':       { zh: '輸入你的數學題目，例如：解 2x + 5 = 13...', en: 'Enter your math problem, for example: Solve 2x + 5 = 13...' },
        'solver.uploadLabel':       { zh: '📷 上傳題目圖片（可選）',   en: '📷 Upload Problem Image (Optional)' },
        'solver.analyze':           { zh: '分析題目 ✨',             en: 'Analyze Problem ✨' },
        'solver.examples':          { zh: '查看範例 📖',             en: 'View Examples 📖' },
        'solver.examplesTitle':     { zh: '📋 範例題目',             en: '📋 Example Problems' },
        'solver.loading':           { zh: 'AI 正在分析你的題目...',   en: 'AI is analyzing your problem...' },
        'solver.problem':           { zh: '📚 題目',                en: '📚 Problem' },
        'solver.restart':           { zh: '🔄 重新開始',            en: '🔄 Restart' },
        'solver.completedSteps':    { zh: '✅ 已完成步驟',           en: '✅ Completed Steps' },
        'solver.solvingSteps':      { zh: '📍 解題步驟',            en: '📍 Solving Steps' },
        'solver.yourAnswer':        { zh: '你的答案：',              en: 'Your Answer:' },
        'solver.answerPlaceholder': { zh: '輸入你的答案（支援多行）...', en: 'Enter your answer (multi-line supported)...' },
        'solver.submitAnswer':      { zh: '提交答案 ✓',             en: 'Submit Answer ✓' },
        'solver.continue':          { zh: '繼續 ➜',                en: 'Continue ➜' },
        'solver.prevStep':          { zh: '⬅ 回到上一步',           en: '⬅ Back to Previous Step' },
        'solver.hint':              { zh: '💡 提示',                en: '💡 Hint' },
        'solver.showAnswer':        { zh: '👀 顯示答案',            en: '👀 Show Answer' },
        'solver.congrats':          { zh: '恭喜！你已成功解答題目。',  en: 'Congratulations! You solved the problem.' },
        'solver.tryAnother':        { zh: '🚀 解更多題目',           en: '🚀 Solve Another Problem' },
        'solver.exploreMore':       { zh: '📚 探索其他模組',         en: '📚 Explore Other Modules' },
        'solver.error':             { zh: '⚠️ 錯誤',               en: '⚠️ Error' },
        'solver.ok':                { zh: '確定',                   en: 'OK' },
        // Dynamic text in JS
        'solver.noSteps':           { zh: '尚無已完成步驟。',         en: 'No completed steps yet.' },
        'solver.provideNext':       { zh: '請提供下一步（第 {n} 步）', en: 'Please provide the next step (Step {n})' },
        'solver.provideNextDesc':   { zh: '輸入你認為下一步應該進行的運算或推理。', en: 'Enter the operation or reasoning you think should come next.' },
        'solver.hintGenerating':    { zh: 'AI 正在生成提示...', en: 'AI is generating a hint...' },
        'solver.atFirstStep':       { zh: '你已經在第一步了。', en: 'You are already at the first step.' },
        'solver.returnedPrev':      { zh: '已回到上一步。請重新嘗試。', en: 'Returned to the previous step. Please try again.' },
        'solver.enterStep':         { zh: '請先輸入你的下一步。', en: 'Please enter your next step first.' },
        'solver.enterProblemErr':   { zh: '請輸入題目或上傳圖片。', en: 'Please enter a problem or upload an image.' },
        'solver.problemLabel':      { zh: '📌 題目：', en: '📌 Problem:' },
        'solver.stepLabel':         { zh: '步驟 {n}：{s}', en: 'Step {n}: {s}' },
        'solver.finalProblem':      { zh: '✅ 題目：', en: '✅ Problem:' },
        'solver.finalSteps':        { zh: '✅ 已完成步驟：', en: '✅ Completed Steps:' },
        'solver.finalSummary':      { zh: '🎯 總結：', en: '🎯 Summary:' },

        // Example tags
        'solver.tagLinear':         { zh: '一元一次方程', en: 'Linear Equation' },
        'solver.tagPythag':         { zh: '畢氏定理', en: 'Pythagorean Theorem' },
        'solver.tagCircle':         { zh: '圓形面積', en: 'Circle Area' },
        'solver.tagQuadratic':      { zh: '二次方程', en: 'Quadratic Equation' },
        'solver.exLinear':          { zh: '解一元一次方程：3x - 7 = 11', en: 'Solve the linear equation: 3x - 7 = 11' },
        'solver.exPythag':          { zh: '直角三角形兩直角邊為 3 和 4，求斜邊。', en: 'A right triangle has legs 3 and 4. Find the hypotenuse.' },
        'solver.exCircle':          { zh: '求半徑為 5 的圓的面積。', en: 'Find the area of a circle with radius 5.' },
        'solver.exQuadratic':       { zh: '解二次方程：x² - 5x + 6 = 0', en: 'Solve the quadratic equation: x² - 5x + 6 = 0' },

        // ─────────────────────────────────────────────
        //  LEARNING PLANNER
        // ─────────────────────────────────────────────
        'planner.breadcrumb':       { zh: 'AI Learning Planner', en: 'AI Learning Planner' },
        'planner.viewSaved':        { zh: '📂 查看上次計劃', en: '📂 View Saved Plan' },
        'planner.heroEyebrow':      { zh: 'AI 智能備試規劃', en: 'AI Smart Exam Preparation' },
        'planner.heroTitle':        { zh: '制定你的<span class="accent-word"> DSE 備試計劃</span>', en: 'Create Your<span class="accent-word"> DSE Study Plan</span>' },
        'planner.heroAccent':       { zh: ' DSE 備試計劃', en: ' DSE Study Plan' },
        'planner.heroDesc':         { zh: '回答 3 組問題，AI 將根據你的程度與目標，量身打造一份專屬備試策略。', en: 'Answer 3 sets of questions, and AI will tailor a personalised exam preparation strategy based on your level and goals.' },
        'planner.chip1':            { zh: '🎯 專為 DSE 數學設計', en: '🎯 Designed for DSE Math' },
        'planner.chip2':            { zh: '🤖 AI 即時分析', en: '🤖 Real-time AI Analysis' },
        'planner.chip3':            { zh: '📊 個人化推薦', en: '📊 Personalised Recommendations' },
        'planner.stepGoal':         { zh: '學習目標', en: 'Learning Goals' },
        'planner.stepDiag':         { zh: '能力診斷', en: 'Ability Diagnosis' },
        'planner.stepPref':         { zh: '偏好設定', en: 'Preferences' },

        // Step 1
        'planner.s1Number':         { zh: '第 1 步 · 共 3 步', en: 'Step 1 of 3' },
        'planner.s1Title':          { zh: '設定學習目標', en: 'Set Learning Goals' },
        'planner.s1Subtitle':       { zh: '告訴我你的 DSE 目標，AI 將根據考試要求為你規劃重點。', en: 'Tell me your DSE target, and AI will plan the focus based on exam requirements.' },
        'planner.q1Label':          { zh: '你的 DSE 數學科目標成績是什麼？', en: 'What is your DSE Math target grade?' },
        'planner.l2Sub':            { zh: '達標，取得合格資格', en: 'Pass, achieve qualifying grade' },
        'planner.l34Sub':           { zh: '穩步發揮，爭取中等成績', en: 'Steady performance, aim for average' },
        'planner.l5Sub':            { zh: '拔尖，挑戰頂尖大學門檻', en: 'Excel, challenge top university thresholds' },
        'planner.q2Label':          { zh: '你是否同時修讀 DSE 數學延伸部分？', en: 'Are you also taking the DSE Math Extended Part?' },
        'planner.coreOnly':         { zh: '只修讀核心課程', en: 'Core Only' },
        'planner.corePlus':         { zh: '核心 +', en: 'Core +' },
        'planner.m1Sub':            { zh: '微積分與統計', en: 'Calculus & Statistics' },
        'planner.m2Sub':            { zh: '代數與微積分', en: 'Algebra & Calculus' },
        'planner.nextDiag':         { zh: '下一步：能力診斷', en: 'Next: Ability Diagnosis' },

        // Step 2
        'planner.s2Number':         { zh: '第 2 步 · 共 3 步', en: 'Step 2 of 3' },
        'planner.s2Title':          { zh: 'DSE 基礎能力診斷', en: 'DSE Basic Ability Diagnosis' },
        'planner.s2Subtitle':       { zh: '以下 3 條題目模擬 DSE Section A(1) 水平，幫助 AI 了解你的基礎強弱。', en: 'The following 3 questions simulate DSE Section A(1) level to help AI understand your strengths and weaknesses.' },
        'planner.diagGeo':          { zh: '📐 DSE Section A(1) — 幾何與度量', en: '📐 DSE Section A(1) — Geometry & Measurement' },
        'planner.diagGeo2':         { zh: '📐 DSE Section A(1) — 幾何', en: '📐 DSE Section A(1) — Geometry' },
        'planner.diagSurd':         { zh: '🔢 DSE Section A(1) — 無理數', en: '🔢 DSE Section A(1) — Surds' },
        'planner.qCircle':          { zh: '半徑為 5 的圓形，其面積是多少？', en: 'What is the area of a circle with radius 5?' },
        'planner.qPythag':          { zh: '直角三角形兩直角邊為 3 和 4，斜邊 c 是多少？', en: 'A right triangle has legs 3 and 4. What is the hypotenuse c?' },
        'planner.qSqrt2':          { zh: '√2 的近似值大約為多少？', en: 'What is the approximate value of √2?' },
        'planner.unsure':           { zh: '不確定', en: 'Not Sure' },
        'planner.back':             { zh: '上一步', en: 'Previous' },
        'planner.nextPref':         { zh: '下一步：偏好設定', en: 'Next: Preferences' },

        // Step 3
        'planner.s3Number':         { zh: '第 3 步 · 共 3 步', en: 'Step 3 of 3' },
        'planner.s3Title':          { zh: '個人化學習偏好', en: 'Personalised Learning Preferences' },
        'planner.s3Subtitle':       { zh: '最後一步！告訴我你的學習習慣，AI 將量身調整計劃的深度與節奏。', en: 'Last step! Tell me your study habits so AI can adjust the plan depth and pace.' },
        'planner.qInterests':       { zh: '你希望在哪些範疇加強？', en: 'Which areas would you like to improve?' },
        'planner.multiSelect':      { zh: '可多選', en: 'Multi-select' },
        'planner.intGeom':          { zh: '幾何與度量', en: 'Geometry & Mensuration' },
        'planner.intAlg':           { zh: '數與代數', en: 'Numbers & Algebra' },
        'planner.intProb':          { zh: '概率', en: 'Probability' },
        'planner.intFunc':          { zh: '函數與圖形', en: 'Functions & Graphs' },
        'planner.qTime':            { zh: '每星期能投入多少時間溫習數學？', en: 'How many hours per week can you study math?' },
        'planner.time1':            { zh: '1–3 小時', en: '1–3 hours' },
        'planner.time1Sub':         { zh: '時間有限，需要高效率備試', en: 'Limited time, need efficient study' },
        'planner.time2':            { zh: '3–7 小時', en: '3–7 hours' },
        'planner.time2Sub':         { zh: '穩定學習節奏', en: 'Steady study pace' },
        'planner.time3':            { zh: '7 小時以上', en: '7+ hours' },
        'planner.time3Sub':         { zh: '全力衝刺', en: 'Full sprint' },
        'planner.qStyle':           { zh: '你傾向哪種學習方式？', en: 'Which learning style do you prefer?' },
        'planner.visual':           { zh: '視覺化學習', en: 'Visual Learning' },
        'planner.visualSub':        { zh: '圖表、動畫輔助理解', en: 'Charts and animations to aid understanding' },
        'planner.interactive':      { zh: '互動練習', en: 'Interactive Practice' },
        'planner.interactiveSub':   { zh: '動手操作、即時反饋', en: 'Hands-on practice with instant feedback' },
        'planner.mixed':            { zh: '混合模式', en: 'Mixed Mode' },
        'planner.mixedSub':         { zh: '結合視覺化與互動操作', en: 'Combination of visual and interactive' },
        'planner.submit':           { zh: '✨ 生成我的備試計劃', en: '✨ Generate My Study Plan' },

        // Streaming
        'planner.streamTitle':      { zh: 'AI 正在分析你的水平…', en: 'AI is analyzing your level…' },
        'planner.stream1':          { zh: '📊 分析診斷結果', en: '📊 Analyzing diagnosis results' },
        'planner.stream2':          { zh: '🎯 匹配 DSE 目標策略', en: '🎯 Matching DSE target strategy' },
        'planner.stream3':          { zh: '📚 制定個人化模塊順序', en: '📚 Creating personalised module order' },
        'planner.stream4':          { zh: '💡 生成應試貼士', en: '💡 Generating exam tips' },

        // Dashboard
        'planner.planReady':        { zh: '✅ 計劃已生成', en: '✅ Plan Generated' },
        'planner.dashTitle':        { zh: '你的個人化 DSE 備試計劃', en: 'Your Personalised DSE Study Plan' },
        'planner.download':         { zh: '📥 下載計劃', en: '📥 Download Plan' },
        'planner.restartTest':      { zh: '🔄 重新測試', en: '🔄 Retake Test' },
        'planner.summaryTitle':     { zh: '📊 評估摘要', en: '📊 Assessment Summary' },
        'planner.swTitle':          { zh: '💪 強弱分析', en: '💪 Strengths & Weaknesses' },
        'planner.tipsTitle':        { zh: '💡 DSE 應試貼士', en: '💡 DSE Exam Tips' },
        'planner.startFirst':       { zh: '🚀 立即開始第一個模塊', en: '🚀 Start First Module Now' },
        'planner.recModules':       { zh: '推薦學習模塊', en: 'Recommended Modules' },
        'planner.startLearning':    { zh: '開始學習 →', en: 'Start Learning →' },
        'planner.diagScore':        { zh: '診斷測試得分', en: 'Diagnostic Score' },
        'planner.targetGrade':      { zh: 'DSE 目標成績', en: 'DSE Target Grade' },
        'planner.courseLabel':      { zh: '修讀課程', en: 'Course' },
        'planner.weeklyTime':       { zh: '每週溫習時間', en: 'Weekly Study Time' },
        'planner.recCount':         { zh: '推薦模塊數量', en: 'Recommended Modules' },
        'planner.strengths':        { zh: '💪 強項', en: '💪 Strengths' },
        'planner.weaknesses':       { zh: '📈 有待加強', en: '📈 Areas for Improvement' },
        'planner.perfect':          { zh: '滿分！', en: 'Perfect!' },
        'planner.good':             { zh: '良好', en: 'Good' },
        'planner.needsWork':        { zh: '需加強', en: 'Needs Improvement' },
        'planner.moduleUnit':       { zh: '個模塊', en: ' modules' },
        'planner.moduleOrder':      { zh: '第 {n} 個模塊', en: 'Module {n}' },
        'planner.serviceError':     { zh: 'AI 服務暫時無法連接，請稍後再試。', en: 'AI service temporarily unavailable. Please try again later.' },

        // Validation errors
        'planner.errLevel':         { zh: '請選擇你的 DSE 目標成績。', en: 'Please select your DSE target grade.' },
        'planner.errModule':        { zh: '請選擇你的修讀課程。', en: 'Please select your course.' },
        'planner.errAnswer':        { zh: '請選擇一個答案。', en: 'Please select an answer.' },
        'planner.errTime':          { zh: '請選擇每週溫習時間。', en: 'Please select weekly study time.' },
        'planner.errStyle':         { zh: '請選擇你的學習風格。', en: 'Please select your learning style.' },

        // Download text
        'planner.dlHeader':         { zh: '===== DSE 數學備試計劃 =====', en: '===== DSE Math Study Plan =====' },
        'planner.dlGenTime':        { zh: '生成時間：', en: 'Generated at: ' },
        'planner.dlTarget':         { zh: '目標成績：', en: 'Target Grade: ' },
        'planner.dlCourse':         { zh: '修讀課程：', en: 'Course: ' },
        'planner.dlScore':          { zh: '基礎測試得分：', en: 'Diagnostic Score: ' },
        'planner.dlWeekly':         { zh: '每週溫習時間：', en: 'Weekly Study Time: ' },
        'planner.dlOverall':        { zh: '=== 整體評估 ===', en: '=== Overall Assessment ===' },
        'planner.dlStrengths':      { zh: '=== 強項 ===', en: '=== Strengths ===' },
        'planner.dlWeak':           { zh: '=== 有待加強 ===', en: '=== Areas for Improvement ===' },
        'planner.dlStrategy':       { zh: '=== 備試策略 ===', en: '=== Study Strategy ===' },
        'planner.dlTips':           { zh: '=== DSE 應試貼士 ===', en: '=== DSE Exam Tips ===' },
        'planner.dlModules':        { zh: '=== 推薦學習模塊 ===', en: '=== Recommended Modules ===' },
        'planner.dlEncourage':      { zh: '=== 加油！===', en: '=== Good Luck! ===' },

        // Streaming messages
        'planner.sMsg1':            { zh: '正在解析你的 DSE 目標與診斷結果…', en: 'Analyzing your DSE target and diagnostic results…' },
        'planner.sMsg2':            { zh: '比對 DSE 歷屆卷題型與考試重點…', en: 'Matching DSE past paper question types and exam focus…' },
        'planner.sMsg3':            { zh: '根據每週時間制定最優學習節奏…', en: 'Creating optimal study rhythm based on weekly time…' },
        'planner.sMsg4':            { zh: '生成個人化模塊推薦順序…', en: 'Generating personalised module recommendations…' },
        'planner.sMsg5':            { zh: '整理 DSE 應試策略與貼士…', en: 'Compiling DSE exam strategies and tips…' },

        // ─────────────────────────────────────────────
        //  DSE GEOMETRY GENERATOR
        // ─────────────────────────────────────────────
        'geo.breadcrumb':           { zh: '動態幾何生成器', en: 'Geometry Generator' },
        'geo.genTitle':             { zh: '✨ 生成幾何題', en: '✨ Generate Geometry Problem' },
        'geo.topicLabel':           { zh: '主題 (Topic)', en: 'Topic' },
        'geo.diffLabel':            { zh: '難度 (Difficulty)', en: 'Difficulty' },
        'geo.promptLabel':          { zh: '自訂指令 (Prompt)', en: 'Custom Prompt' },
        'geo.promptPlaceholder':    { zh: '例如：生成一題求圓周角的題目...', en: 'e.g. Generate a circle inscribed angle problem...' },
        'geo.generateBtn':          { zh: '生成題目', en: 'Generate Problem' },
        'geo.slidersTitle':         { zh: '🎛️ 動態操作面板', en: '🎛️ Dynamic Controls' },
        'geo.slidersEmpty':         { zh: '生成題目後，此處將出現拖曳控制項。', en: 'After generating, drag controls will appear here.' },
        'geo.emptyTitle':           { zh: '尚未生成題目', en: 'No Problem Generated' },
        'geo.emptyDesc':            { zh: '請從左側面板選擇主題並點擊「生成題目」，見證 AI 動態生成互動式幾何題。', en: 'Select a topic from the left panel and click "Generate Problem" to see AI dynamically generate an interactive geometry problem.' },
        'geo.questionHeader':       { zh: '題目敘述', en: 'Problem Description' },
        'geo.markingScheme':        { zh: '查看評分標準 (Marking Scheme)', en: 'View Marking Scheme' },
        'geo.validationReport':     { zh: '🔍 驗證報告 (Validation Report)', en: '🔍 Validation Report' },
        'geo.save':                 { zh: '💾 儲存題目', en: '💾 Save Problem' },
        'geo.exportPdf':            { zh: '📑 導出 PDF', en: '📑 Export PDF' },
        'geo.exportTxt':            { zh: '📄 導出 TXT', en: '📄 Export TXT' },
        'geo.saving':               { zh: '⏳ 儲存中…', en: '⏳ Saving…' },
        'geo.saved':                { zh: '✅ 題目已儲存到題庫！', en: '✅ Problem saved to library!' },
        'geo.saveFail':             { zh: '儲存失敗：', en: 'Save failed: ' },
        'geo.exportDone':           { zh: '📥 已導出 {f} 檔案', en: '📥 Exported {f} file' },
        'geo.exportFail':           { zh: '導出失敗：', en: 'Export failed: ' },
        'geo.genFail':              { zh: '題目生成失敗: ', en: 'Problem generation failed: ' },
        'geo.noApiKey':             { zh: '未找到 API Key，請在 .env 設定 GEMINI_API_KEY 並重啟伺服器。', en: 'API Key not found. Please set GEMINI_API_KEY in .env and restart the server.' },
        'geo.noData':               { zh: '尚未生成題目，無法儲存。', en: 'No problem generated. Cannot save.' },
        'geo.noDataExport':         { zh: '尚未生成題目，無法導出。', en: 'No problem generated. Cannot export.' },
        'geo.loading':              { zh: '載入中...', en: 'Loading...' },
        'geo.noSliders':            { zh: '沒有動態操作項', en: 'No dynamic controls' },

        // Geometry topics
        'geo.topicCircle':          { zh: '圓的幾何 (Geometry of Circle)', en: 'Geometry of Circle' },
        'geo.topicLocus':           { zh: '直線軌跡 (Locus)', en: 'Locus' },
        'geo.topicTrig':            { zh: '三角學 (Trigonometry)', en: 'Trigonometry' },
        'geo.topicSimilar':         { zh: '相似與全等 (Similarity & Congruence)', en: 'Similarity & Congruence' },

        // Difficulty
        'diff.level2':              { zh: 'DSE Level 2 (基礎)', en: 'DSE Level 2 (Basic)' },
        'diff.level4':              { zh: 'DSE Level 4 (中階)', en: 'DSE Level 4 (Intermediate)' },
        'diff.level5':              { zh: 'DSE Level 5* (進階)', en: 'DSE Level 5* (Advanced)' },

        // ─────────────────────────────────────────────
        //  DSE ALGEBRA GENERATOR
        // ─────────────────────────────────────────────
        'alg.breadcrumb':           { zh: '代數問題生成器', en: 'Algebra Generator' },
        'alg.genTitle':             { zh: '🧮 生成代數題', en: '🧮 Generate Algebra Problem' },
        'alg.topicLabel':           { zh: '課題 (Topic)', en: 'Topic' },
        'alg.subtopicLabel':        { zh: '子課題 (Subtopic)', en: 'Subtopic' },
        'alg.diffLabel':            { zh: '難度 (Difficulty)', en: 'Difficulty' },
        'alg.generateBtn':          { zh: '生成題目', en: 'Generate Problem' },
        'alg.hintTitle':            { zh: '💡 使用提示', en: '💡 Usage Tips' },
        'alg.hintDesc':             { zh: '選擇課題與難度後，點擊「生成題目」即可取得 AI 即時生成的 DSE 格式代數題。每次點擊將產生全新題目。', en: 'Select a topic and difficulty, then click "Generate Problem" to get an AI-generated DSE algebra problem. Each click generates a new problem.' },
        'alg.emptyTitle':           { zh: '尚未生成題目', en: 'No Problem Generated' },
        'alg.emptyDesc':            { zh: '請從左側面板選擇課題、子課題及難度，然後點擊「生成題目」，見證 AI 動態生成 DSE 代數題。', en: 'Select topic, subtopic and difficulty from the left panel, then click "Generate Problem" to see AI generate a DSE algebra problem.' },
        'alg.questionHeader':       { zh: '📝 題目敘述', en: '📝 Problem Description' },
        'alg.solutionHeader':       { zh: '📖 查看解題步驟 (Solution Steps)', en: '📖 View Solution Steps' },
        'alg.finalAnswer':          { zh: '✅ 最終答案：', en: '✅ Final Answer: ' },
        'alg.markingHeader':        { zh: '📊 查看評分標準 (Marking Scheme)', en: '📊 View Marking Scheme' },
        'alg.markingDetail':        { zh: '評分細則', en: 'Marking Details' },
        'alg.marks':                { zh: '分', en: ' marks' },
        'alg.save':                 { zh: '💾 儲存題目', en: '💾 Save Problem' },
        'alg.exportPdf':            { zh: '📑 導出 PDF', en: '📑 Export PDF' },
        'alg.exportTxt':            { zh: '📄 導出 TXT', en: '📄 Export TXT' },
        'alg.saving':               { zh: '⏳ 儲存中…', en: '⏳ Saving…' },
        'alg.saved':                { zh: '✅ 題目已儲存到題庫！', en: '✅ Problem saved to library!' },
        'alg.genSuccess':           { zh: '題目生成成功！', en: 'Problem generated successfully!' },
        'alg.genFail':              { zh: '題目生成失敗: ', en: 'Problem generation failed: ' },

        // ─────────────────────────────────────────────
        //  MY PROBLEMS
        // ─────────────────────────────────────────────
        'myp.breadcrumb':           { zh: '我的題庫', en: 'My Problems' },
        'myp.title':                { zh: '📚 我的題庫', en: '📚 My Problems' },
        'myp.desc':                 { zh: '管理已儲存的 AI 生成題目，支援導出和重新載入編輯。', en: 'Manage saved AI-generated problems. Export and reload supported.' },
        'myp.totalCount':           { zh: '題目總數', en: 'Total' },
        'myp.geoCount':             { zh: '幾何', en: 'Geometry' },
        'myp.algCount':             { zh: '代數', en: 'Algebra' },
        'myp.filterAll':            { zh: '全部', en: 'All' },
        'myp.filterGeo':            { zh: '📐 幾何', en: '📐 Geometry' },
        'myp.filterAlg':            { zh: '🧮 代數', en: '🧮 Algebra' },
        'myp.allLevels':            { zh: '全部難度', en: 'All Levels' },
        'myp.batchSelect':          { zh: '☑ 批量選取', en: '☑ Batch Select' },
        'myp.selectAll':            { zh: '全選', en: 'Select All' },
        'myp.selected':             { zh: '已選 {n} 題', en: '{n} selected' },
        'myp.batchTxt':             { zh: '📄 合併導出 TXT', en: '📄 Export as TXT' },
        'myp.batchPdf':             { zh: '📑 合併導出 PDF', en: '📑 Export as PDF' },
        'myp.batchCancel':          { zh: '✕ 取消選取', en: '✕ Cancel Selection' },
        'myp.emptyTitle':           { zh: '題庫是空的', en: 'Library is empty' },
        'myp.emptyDesc':            { zh: '前往幾何生成器或代數生成器，生成題目後點擊「💾 儲存題目」即可將題目加入題庫。', en: 'Go to the Geometry or Algebra Generator. Generate a problem and click "💾 Save Problem" to add it to your library.' },
        'myp.loading':              { zh: '正在載入題庫…', en: 'Loading library…' },
        'myp.deleteTitle':          { zh: '⚠️ 確認刪除', en: '⚠️ Confirm Delete' },
        'myp.deleteDesc':           { zh: '確定要刪除此題目嗎？此操作無法復原。', en: 'Are you sure you want to delete this problem? This action cannot be undone.' },
        'myp.cancel':               { zh: '取消', en: 'Cancel' },
        'myp.delete':               { zh: '刪除', en: 'Delete' },

        // ─────────────────────────────────────────────
        //  INTERACTIVE VIZ PAGES (shared)
        // ─────────────────────────────────────────────
        'viz.scrollHint':           { zh: '↓ 往下滾動以開始互動動畫', en: '↓ Scroll down to start the interactive animation' },
        'viz.catGeometry':          { zh: '幾何與測量', en: 'Geometry & Measurement' },
    };

    // ══════════════════════════════════════════════════════════
    //  CORE API
    // ══════════════════════════════════════════════════════════
    const _listeners = [];

    function getLang() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && SUPPORTED.includes(stored)) return stored;
        } catch (_) {}
        return DEFAULT_LANG;
    }

    function setLang(lang) {
        if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
        try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
        applyAll();
        _updateToggleUI();
        _listeners.forEach(cb => { try { cb(lang); } catch (_) {} });
    }

    function t(key, replacements) {
        const entry = TRANSLATIONS[key];
        if (!entry) return key;
        let text = entry[getLang()] || entry.zh || key;
        if (replacements) {
            Object.keys(replacements).forEach(k => {
                text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), replacements[k]);
            });
        }
        return text;
    }

    function applyAll() {
        // data-i18n → textContent
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const val = t(key);
            if (val !== key) el.textContent = val;
        });

        // data-i18n-html → innerHTML
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            const val = t(key);
            if (val !== key) el.innerHTML = val;
        });

        // data-i18n-placeholder → placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const val = t(key);
            if (val !== key) el.placeholder = val;
        });

        // data-i18n-title → title
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const val = t(key);
            if (val !== key) el.title = val;
        });

        // Update html lang attribute
        document.documentElement.lang = getLang() === 'zh' ? 'zh-TW' : 'en';
    }

    function onLangChange(callback) {
        if (typeof callback === 'function') _listeners.push(callback);
    }

    // ══════════════════════════════════════════════════════════
    //  LANGUAGE TOGGLE UI — Auto-injected into sidebar
    // ══════════════════════════════════════════════════════════
    function _injectToggle() {
        if (document.getElementById('lang-switcher')) return;

        const lang = getLang();
        const btnHtml = `
            <button type="button" class="lang-btn${lang === 'zh' ? ' active' : ''}" data-lang="zh" id="lang-btn-zh">繁體中文</button>
            <button type="button" class="lang-btn${lang === 'en' ? ' active' : ''}" data-lang="en" id="lang-btn-en">English</button>
        `;

        const footer = document.querySelector('.sidebar-footer');
        if (footer) {
            // Sidebar layout — inject before footer
            const wrap = document.createElement('div');
            wrap.id = 'lang-switcher';
            wrap.className = 'lang-switcher';
            wrap.innerHTML = btnHtml;
            footer.parentNode.insertBefore(wrap, footer);
            wrap.addEventListener('click', _handleToggleClick);
        } else {
            // Standalone layout — inject floating toggle in top-right
            const wrap = document.createElement('div');
            wrap.id = 'lang-switcher';
            wrap.className = 'lang-switcher lang-switcher-float';
            wrap.innerHTML = btnHtml;
            document.body.appendChild(wrap);
            wrap.addEventListener('click', _handleToggleClick);
        }
    }

    function _handleToggleClick(e) {
        const btn = e.target.closest('.lang-btn');
        if (!btn) return;
        setLang(btn.dataset.lang);
    }

    function _updateToggleUI() {
        const lang = getLang();
        const zhBtn = document.getElementById('lang-btn-zh');
        const enBtn = document.getElementById('lang-btn-en');
        if (zhBtn) zhBtn.classList.toggle('active', lang === 'zh');
        if (enBtn) enBtn.classList.toggle('active', lang === 'en');
    }

    // ══════════════════════════════════════════════════════════
    //  INIT
    // ══════════════════════════════════════════════════════════
    // Inject toggle when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            _injectToggle();
            applyAll();
        });
    } else {
        _injectToggle();
        applyAll();
    }

    // ══════════════════════════════════════════════════════════
    //  EXPORT as global
    // ══════════════════════════════════════════════════════════
    window.i18n = {
        getLang,
        setLang,
        t,
        applyAll,
        onLangChange,
        TRANSLATIONS
    };

})();
