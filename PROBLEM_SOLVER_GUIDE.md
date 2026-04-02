# 🤖 AI Math Problem Solver - User Guide

## 📌 Features

This module provides an **AI-powered interactive math learning system** where users can:

1. **Upload Problems** 📝
   - Input any math problem
   - Or choose from provided example problems

2. **Problem Understanding** 🧠
   - Support text input or image upload
   - Images can be converted to problem text via OCR/AI

3. **Step-by-Step Solutions** 📍
   - Users input each "next step" themselves
   - Get immediate feedback for each submission
   - See the problem and completed steps at each stage

4. **Hint & Answer Mechanism** 💡
   - **Hint Button**: Provides direction only, not the answer
   - **Show Answer Button**: Appears only when a step is wrong, shows only that step's answer

## 🚀 Quick Start

### Step 1: Configure Server API

1. Visit [Hugging Face](https://huggingface.co/)
2. Register for a free account (or log in to existing account)
3. Go to **Settings  Access Tokens**
4. Create a new Token (select "read" permission)
5. Set `HF_API_TOKEN` in server environment variables

> **Cost**: Completely free! Hugging Face provides free API call quota.

### Step 2: Use the Problem Solver

1. Open `problem-solver.html`
2. Users don't need to input the API Token
3. Input a problem or upload a problem image
4. Submit your next step incrementally

### Local Startup (Windows PowerShell)

```powershell
cd circle-area-animation
python server.py
```

After startup, browse: `http://localhost:8000/problem-solver.html`

### .env Local Configuration

First copy the template file:

```powershell
cd circle-area-animation
Copy-Item .env.example .env
```

Add to `circle-area-animation/.env`:

```env
HF_API_TOKEN=your_huggingface_token
```

`server.py` will automatically read `.env` on startup.

Note: `.env` will not be committed to Git (already in `.gitignore`).

### Vercel Deployment Configuration

1. Set Root Directory to `circle-area-animation` in Vercel project settings
2. Go to Settings  Environment Variables in Vercel project page
3. Add `HF_API_TOKEN` with your Hugging Face Token value
4. Redeploy

After deployment:
- Frontend calls `/api/hf`
- Vercel Serverless Function reads `process.env.HF_API_TOKEN` in `api/hf.js`
- Users don't need to know or see the Token

## 📋 Usage Examples

### Example 1: Simple Equation

**Problem**: `Solve the linear equation: 3x - 7 = 11`

1. AI will identify this as a linear equation problem
2. Show solution approach: "Rearrange"  "Combine like terms"  "Solve for x"
3. Guide you through inputting each step
4. Verify correctness of each step

### Example 2: Pythagorean Theorem

**Problem**: `A right triangle has legs of length 3 and 4. Find the hypotenuse.`

AI will:
- Identify this as a Pythagorean theorem problem
- Show steps: Identify sides  Apply Pythagorean theorem  Calculate
- Allow different ways to express answers (e.g., c² = 25 or c = 5)

## 🔧 Technical Details

### Architecture

```
problem-solver.html (UI Structure)
    
problem-solver.css (Visual Design)
    
problem-solver.js (Logic and API Calls)
    
Hugging Face API (AI Inference)
```

### Workflow

```
User inputs problem or uploads image
    
Frontend organizes problem + completed steps
    
User submits next step
    
AI judges if step is correct
    
Correct: Move to next step; Wrong: Retry and optionally show answer
    
Until problem complete, show summary
```

### API Integration

- **API Provider**: Hugging Face
- **Models**: CohereLabs/tiny-aya-global:cohere (with fallback models)
- **Format**: Uses JSON-formatted prompts for structured data return
- **Storage**: API Token managed server-side via `HF_API_TOKEN` environment variable
- **Vercel Routes**: `api/hf.js`, `api/health.js`
- **Inference Endpoint**: `https://router.huggingface.co/v1/chat/completions`

## 🎓 Educational Advantages

1. **Personalized Learning** - AI adjusts feedback based on user's steps
2. **Immediate Feedback** - Each step receives validation and explanation
3. **Progressive Difficulty** - Hints can escalate progressively
4. **Diverse Topics** - Supports problems from various math domains
5. **Free to Use** - No hidden costs

## 🛠️ Troubleshooting

### "Connection Failed"

- Check if `/api/health` is accessible
- Verify environment variable `HF_API_TOKEN` is configured
- Ensure network connection is working

### "AI Response Format Incorrect"

- This may happen if AI returns unexpected format
- Try resubmitting with different wording

### Token Expired

- Hugging Face Tokens don't expire, but if not working:
  1. Regenerate Token in Hugging Face dashboard
  2. Update server environment variable `HF_API_TOKEN`
  3. Redeploy (Vercel) or restart local service

## 📁 File Structure

```
circle-area-animation/
 index.html                    (Homepage)
 problem-solver.html           (Problem solver page)
 problem-solver.css            (Dedicated styles)
 problem-solver.js             (Core logic)
 .env                          (Local environment variables)
 api/
    health.js                 (Health check)
    hf.js                     (Hugging Face proxy)
 ...(Other existing modules)
```

## 🔐 Privacy and Security

- API Token stored only in server environment variables, not exposed to frontend
- Frontend only calls local backend API (`/api/hf`)
- All problems and answers processed only on client side

## 💡 Tips

- Complex problems may require multiple API adjustments
- If AI can't understand your problem, try clearer wording
- Try various math domains: algebra, geometry, calculus, statistics, etc.

## 🚧 Future Feature Plans

- [ ] Save problem-solving history
- [ ] Problem difficulty level classification
- [ ] Practice statistics and progress tracking
- [ ] Support multiple AI model options
- [ ] Local AI model support (offline)

---

**Version**: 1.0  
**Last Updated**: March 30, 2026  
**Developer**: Education 4.0 Team

🎯 **Happy learning!**
