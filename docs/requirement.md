DSE 數學智能輔助出題系統 - 核心功能需求規格書 (SRS)

1. 系統概述

本系統為專為香港中學文憑試 (HKDSE) 數學科設計的「Agentic 智能出題與微調平台」，涵蓋**「度量、圖形與空間」及「數與代數」**兩大核心範疇。
系統打破傳統題庫的純文字限制，利用 Google Gemini API 進行結構化生成，配合前端參數化渲染引擎（SVG/Canvas 及 KaTeX），讓教師能視覺化地微調題目變數。結合「DSE 歷屆正確率數據」作為難度基準，與輕量級後端 (如 Supabase) 的儲存機制，系統賦予教師強大的「編排者 (Orchestrator)」能力，實現高品質題目的動態生成、精準評分與永久重用。

2. 核心功能模組 (Core Functional Requirements)

2.1 模組一：度量、圖形與空間 (Geometry & Space Visual Engine)

解決傳統出題軟體無法動態生成與微調幾何圖形的痛點。

參數化 SVG/Canvas 渲染：

前端系統能解析 Gemini 輸出的結構化 JSON，自動繪製 2D 幾何圖形（如圓形、三角形、弦、切線）。

圖形並非靜態圖片，而是由數學公式驅動。當教師在前端調整變數（如拖動滑桿改變 $\angle ABC$ 為 $120^\circ$）時，前端引擎即時 (Real-time) 重繪圖形比例，無需重新呼叫 API。

動態 3D 空間互動 (進階視覺化)：

針對「三維空間三角學 (3D Trigonometry)」課題，整合 React Three Fiber 渲染 3D 模型（如角錐體）。

允許教師與學生在網頁上用滑鼠拖曳旋轉 3D 圖形，並動態標示「線與平面的交角」，徹底解決紙本考卷空間感不足的缺陷。

2.2 模組二：數與代數 (Algebra Parametric Engine)

專注於生成具備高度變化性的代數長短題目。

多階題型與變數綁定：

支援 DSE Paper 1 的連鎖題型（如 (a) 求常數 $k$，(b) 解方程式）。

方程式中的常數設為可調變數。前端調整參數時，系統會自動更新題目的數學公式。

專業數學排版 (Mathematical Typesetting)：

系統內建 KaTeX 或 MathJax，確保所有多項式、根式、分數及特殊符號，皆能以標準 DSE 試卷的專業學術格式渲染。

2.3 模組三：歷屆正確率數據與 Gemini API 深度整合 (Data-Driven AI)

利用真實考試數據輔助 AI 克服「難度不可控」的先天缺陷。

歷史數據庫映射 (Historical Mapping)：

系統內建一份 DSE 考評局歷屆試題的「課題與全港考生答對率」對照表（例如：2019 Q12 變分題，答對率 38%）。

基於數據的 Prompt 增強 (Data-Augmented Prompting)：

結合方式： 當教師在介面選擇「目標答對率：30%-40% (高難度)」時，系統會從數據庫提取該難度區間的題型特徵（如：需要使用圓內接四邊形、加入反射角陷阱、或非首項係數為 1 的二次方程）。

系統將這些特徵作為 System Instruction 動態注入到 Gemini API 的 Prompt 中，強制 Gemini 生成具備該難度特徵的全新題目。

JSON 嚴格輸出與評分參考 (Marking Scheme)：

Gemini API 必須回傳嚴格的 JSON 格式（包含 geometry_state、question_text、variables）。

精準計分： JSON 內必須包含 DSE 標準的 Marking Scheme，明確區分步驟分 (M mark) 及答案分 (A mark)，由前端動態替換變數後顯示。

2.4 模組四：個人題庫與工作檯後端 (Orchestrator Workbench & Backend)

提供完整的 SaaS 體驗，讓教學資產得以沉澱與再利用。

教師微調控制台 (Teacher Dashboard)：

前端自動根據 Gemini 產出的 JSON 生成控制面板（滑桿、勾選框）。

教師可手動開關幾何元素（如「加入圓心 O」）或修改代數係數，系統即時驗證邏輯並更新預覽與評分參考。

輕量雲端儲存 (State Persistence)：

整合 Supabase/Firebase。當教師點擊「儲存」時，系統僅儲存題目的 JSON 狀態與參數（而非圖片或靜態 HTML）。

確保資料庫極度輕量化，且查詢速度極快。

題庫讀取與二次重用 (Edit & Reuse)：

教師可在「我的題庫」模組中瀏覽已儲存的題目。

讀取時，前端重新解析 JSON，完美還原為「可編輯的滑桿工作檯狀態」。教師可以直接修改去年的題目參數（例如把角度稍微改大、方程式係數改掉），一鍵生成今年的全新考卷，達到教育資源的無限重用。