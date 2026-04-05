# 數學代數模組生成器擴展需求書 (Algebra Generator Extension Requirements)

## 1. 背景與目標
目前系統已實作基於 SVG 與變數控制的「幾何問題生成器 (Geometry Problem Generator)」，且採用了統一的 `QuestionData` Schema (包含 `variables`, `points`, `elements`, `question_template` 等)。
有鑑於專案目前已全面升級採用 **Gemini 3 (具備強大 Reasoning 推理模型)** 作為核心 AI，過往大型語言模型在「代數推導邏輯錯誤」或「無法湊出供學生手算的完美整數/分數」等痛點已被徹底解除。

本文件旨在規劃我們該如何高效且低成本地擴展「數與代數」課題的自動生成模組，並優先挑選出與目前架構最契合的課題。

---

## 2. 系統架構限制與分析
雖然 Gemini 3 的數學處理能力極強，但目前前端的渲染引擎架構（參見 `dse-geometry/core/types.ts` 和 `geometry-resolver.ts`）具有以下明確邊界：

*   **支援的繪圖原語 (Elements)**：僅限於二維歐幾里得幾何，包含 `lines` (直線), `circles` (圓形), `arcs` (圓弧), 和 `labels` (標籤)。
*   **不支援的特性**：
    *   **多邊形塗色 (Polygon/Fill Shading)**：無法針對特定封閉區域進行半透明陰影著色。
    *   **任意曲線 (Freeform Curves)**：無原生的方程式曲線繪製機制 (如 $y=x^2$)，若以密集直線段拼接將導致效能低落且難以綁定 slider 變數。

---

## 3. 開發優先級策略 (Roadmap Priorities)

基於上述「AI 算存能力溢出」與「前端繪圖架構限制」的雙重考量，我們對各 DSE 數學課題的擴展順序進行以下重構與定義：

### ✅ 第一階段 (Phase 1)：最高優先級 (High Priority)
**原則：零前端圖像渲染依賴 (Zero Rendering Dependency)**。此階段目標是最大化利用 Gemini 3 的數學推理能力，以最低開發成本實現高價值產出。

*   **實作策略**：讓 AI 在回傳 JSON 時，將 `geometry_state.elements` 留空 `[]` 或直接忽略。前端單純利用 `question_template` 和 `marking_scheme` 配合 KaTeX 渲染純文字題目。
*   **目標課題**：
    1.  **變分 (Variations)**
        *   **痛點解除**：DSE 的變分長題目 (如 $A = k_1 + k_2/B$) 原本極容易讓舊版 AI 產生無解或畸形數字。現在 Gemini 3 可以在後台思考鏈 (CoT) 中推導出能整除的常數 $k_1$ 與 $k_2$，完美適應長題目編寫。
    2.  **多項式 (Polynomials)**
        *   餘式定理 (Remainder Theorem) 及因式定理 (Factor Theorem)。AI 可精準設定 $f(x)$ 參數以便得出漂亮的根。
    3.  **數列與級數 (Sequences and Series)**
        *   等差 (AS) 與等比 (GS) 數列的第 $n$ 項及求和。全部依賴數學表達式，完全無畫圖需求。
    4.  **一元二次方程 (Quadratic Equations)**
        *   求根公式、判別式 (Discriminant, $\Delta$)、以及頂點 (Vertex)。極易參數化。

---

### ⏸️ 第二階段 (Phase 2)：暫緩開發 / 超出滿意範圍 (Out of Scope for V1)
**原則：需要對核心渲染引擎作大規模底層升級 (Major Engine Rewrite Required)。**

*   **目標課題與限制說明**：
    1.  **不等式與線性規劃 (Inequalities and Linear Programming)**
        *   **困難點**：題目核心在於「在圖表中找出最大/最小值」。這必定要求系統動態渲染「可行解區域 (Feasible Region)」的陰影塗層 (Shaded Area)。當前系統缺乏多邊形 (Polygon) 計算與填充 (Fill) 功能，強行在現有 Schema 實作成本極高。
    2.  **函數及其圖像 (Functions and Graphs)**
        *   **困難點**：涉及如平移變換 $f(x) \to f(x-a)$。前端缺乏如同 D3.js 般的原生函數曲線取樣渲染接口。若無平滑曲線支援，將難以讓學生直觀看出函數的圖像變換。
    3.  **指數及對數函數圖像 (Exp & Log Functions)**
        *   **困難點**：此類函數增長幅度極端。若由 AI 隨機生成參數，極易突破前端視圖框 (ViewBox)，需要極其複雜的「自動坐標軸縮放平衡算法 (Auto-scaling algorithm)」來維持圖表的美觀度，CP 值非常低。

---

## 4. 行動方案 (Action Items)

1.  **Prompt Engineering 更新**
    *   新增一份專屬於「無圖表代數題目」的 System Prompt。
    *   在 Prompt 中強制要求模型利用 Reasoning 確保題目數值存在「有理數解/漂亮整數解」，不可產生無限不循環小數等無邏輯的數學前提。
2.  **前端 UI 微調**
    *   在出題控制台新增「關閉圖表預覽」的功能 (或偵測到 `elements` 為空時隱藏 Canvas 區塊)。
    *   保留 Slider 滑桿，用以動態修正題目文字內的 `{{variables}}`。
