# 🤖 AI 數學題目求解助手 - 使用指南

## 📌 功能說明

該模組提供了一個 **AI 輔助的互動式數學學習系統**，用戶可以：

1. **上傳題目** 📝
   - 輸入任何數學題目
   - 或從提供的範例題目中選擇

2. **題目理解** 🧠
    - 支援文字輸入或圖片上傳
    - 圖片可先經 OCR / AI 轉為題目文字

3. **逐步解答** 📍
    - 用戶自行輸入「下一步」
   - 每提交一個答案就得到即時反饋
    - 每一步都會看到題目與已完成步驟

4. **提示與答案機制** 💡
    - **提示按鈕**：只提示下一步方向，不提供答案
    - **顯示答案按鈕**：只有該步驟答錯時才出現，僅顯示該步驟答案

## 🚀 快速開始

### 第一步：伺服器配置 API

1. 訪問 [Hugging Face](https://huggingface.co/)
2. 註冊免費帳戶（或登錄現有帳戶）
3. 進入 **Settings → Access Tokens**
4. 建立一個新的 Token（選擇 "read" 權限）
5. 在伺服器環境變數設定 `HF_API_TOKEN`

> **成本**: 完全免費！Hugging Face 提供免費的 API 調用額度。

### 第二步：使用求解助手

1. 打開 `problem-solver.html`
2. 用戶無需輸入 API Token
3. 輸入題目或上傳題目圖片
4. 逐步提交你的下一步

### 本地啟動方式（Windows PowerShell）

```powershell
cd circle-area-animation
python server.py
```

啟動後瀏覽：`http://localhost:8000/problem-solver.html`

### .env 本地設定

先複製範本檔：

```powershell
cd circle-area-animation
Copy-Item .env.example .env
```

在 `circle-area-animation/.env` 放入：

```env
HF_API_TOKEN=你的_huggingface_token
```

`server.py` 啟動時會自動讀取 `.env`。

注意：`.env` 不會被提交到 Git（已在 `.gitignore`）。

### Vercel 發佈設定

1. 在 Vercel 專案設定中把 Root Directory 設為 `circle-area-animation`
2. 在 Vercel 專案頁面進入 Settings → Environment Variables
3. 新增 `HF_API_TOKEN`，值填入你的 Hugging Face Token
4. 重新部署

部署後：
- 前端呼叫 `/api/hf`
- Vercel Serverless Function 在 `api/hf.js` 讀取 `process.env.HF_API_TOKEN`
- 用戶端不需要也看不到 Token

## 📋 使用範例

### 範例 1：簡單方程式

**題目**: `求解一元一次方程式：3x - 7 = 11`

1. AI 會分析這是一個一元一次方程題目
2. 展示解題思路：「移項」 → 「合併同類項」 → 「求解 x」
3. 引導你每一步輸入答案
4. 驗證每一步是否正確

### 範例 2：勾股定理

**題目**: `一個直角三角形，兩條直角邊長分別為 3 和 4，求斜邊長度`

AI 會：
- 識別這是勾股定理問題
- 展示步驟：識別邊的類型 → 應用勾股定理 → 計算
- 允許你用不同的表述方式提交答案（如 c² = 25 或 c = 5）

## 🔧 技術詳情

### 架構

```
problem-solver.html (UI 結構)
    ↓
problem-solver.css (視覺設計)
    ↓
problem-solver.js (邏輯和 API 調用)
    ↓
Hugging Face API (AI 推理)
```

### 工作流程

```
用戶輸入題目或上傳圖片
    ↓
前端整理題目 + 已完成步驟
    ↓
用戶提交下一步
    ↓
AI 判斷該步驟是否正確
    ↓
正確：進入下一步；錯誤：重答並可顯示該步驟答案
    ↓
直到完成整題，顯示總結
```

### API 整合

- **API 提供商**: Hugging Face
- **模型**: CohereLabs/tiny-aya-global:cohere（含備援模型）
- **格式**: 使用 JSON 格式化提示返回結構化數據
- **存儲**: API Token 由伺服器透過環境變數 `HF_API_TOKEN` 統一管理
- **Vercel 路由**: `api/hf.js`、`api/health.js`
- **推理端點**: `https://router.huggingface.co/v1/chat/completions`

## 🎓 教學優勢

1. **個性化學習** - AI 根據用戶的步驟調整反饋
2. **立即反饋** - 每一步都得到驗證和解釋
3. **循序漸進** - 可以逐步提升提示級別
4. **多樣化題目** - 支持各種數學領域的題目
5. **免費使用** - 沒有隱藏成本

## 🛠️ 故障排除

### 「連接失敗」

- 檢查是否可訪問 `/api/health`
- 檢查環境變數 `HF_API_TOKEN` 是否已設定
- 確保網絡連接正常

### 「AI 回應格式不正確」

- 這可能是因為 AI 返回了意外的格式
- 嘗試用不同的表述方式重新提交問題

### Token 過期

- Hugging Face Token 不會過期，但如果無法工作：
    1. 在 Hugging Face 後台重新生成 Token
    2. 更新伺服器環境變數 `HF_API_TOKEN`
    3. 重新部署（Vercel）或重啟本地服務

## 📁 文件結構

```
circle-area-animation/
├── index.html                    (首頁 - 已更新，包含新卡片)
├── problem-solver.html           (新增 - 求解助手頁面)
├── problem-solver.css            (新增 - 專用樣式)
├── problem-solver.js             (新增 - 核心邏輯)
├── .env                          (新增 - 本地環境變數)
├── api/
│   ├── health.js                 (新增 - 健康檢查)
│   └── hf.js                     (新增 - Hugging Face 代理)
└── ...(其他現有模組)
```

## 🔐 隱私和安全

- API Token 僅存儲在伺服器環境變數中，不暴露給前端用戶
- 前端只調用本地後端 API（`/api/hf`）
- 所有題目和答案都只在客戶端處理

## 💡 提示

- 對於複雜題目，可能需要多次調整 API 調用
- 如果 AI 無法理解你的題目，試著用更清楚的表述方式
- 可以嘗試各種數學領域：代數、幾何、微積分、統計等

## 🚧 未來功能計劃

- [ ] 保存解題歷史
- [ ] 題目難度級別分類
- [ ] 練習統計和進度追蹤
- [ ] 支持多個 AI 模型選擇
- [ ] 本地 AI 模型支持（離線）

---

**版本**: 1.0  
**最後更新**: 2026 年 3 月 30 日  
**開發者**: Education 4.0 Team

🎯 **祝你學習愉快！**
