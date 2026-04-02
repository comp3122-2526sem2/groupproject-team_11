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
   - Users input each next step themselves
   - Get immediate feedback for each submission
   - See the problem and completed steps at each stage

4. **Hint & Answer Mechanism** 💡
   - **Hint Button**: Provides direction only, not the answer
   - **Show Answer Button**: Appears only when a step is wrong, shows only that step's answer

## 🚀 Quick Start

### Step 1: Configure Server API

1. Visit [Hugging Face](https://huggingface.co/)
2. Register for a free account or log in to an existing account
3. Go to **Settings → Access Tokens**
4. Create a new token with the "read" permission
5. Set `HF_API_TOKEN` in the server environment variables

> **Cost**: Completely free. Hugging Face provides a free API call quota.

### Step 2: Use the Problem Solver

1. Open `problem-solver.html`
2. Users do not need to enter the API token
3. Input a problem or upload a problem image
4. Submit each next step incrementally

### Local Startup (Windows PowerShell)

```powershell
cd circle-area-animation
python server.py
```

After startup, browse to `http://localhost:8000/problem-solver.html`.

### .env Local Configuration

First copy the template file:

```powershell
cd circle-area-animation
Copy-Item .env.example .env
```

Add this to `circle-area-animation/.env`:

```env
HF_API_TOKEN=your_huggingface_token
```

`server.py` automatically reads `.env` on startup.

Note: `.env` will not be committed to Git because it is already covered by `.gitignore`.

### Vercel Deployment Configuration

1. Set Root Directory to `circle-area-animation` in the Vercel project settings
2. Open Settings → Environment Variables in the Vercel project page
3. Add `HF_API_TOKEN` with your Hugging Face token value
4. Redeploy

After deployment:
- The frontend calls `/api/hf`
- The Vercel Serverless Function reads `process.env.HF_API_TOKEN` in `api/hf.js`
- Users do not need to know or see the token

## 🤖 AI Learning Planner

The homepage now includes an **AI Learning Planner** entry in the navigation bar. It helps users answer a short assessment, then generates a personalized learning path based on their score, interests, and available study time.

### What It Uses

The planner recommends lessons from the homepage modules:
- Circle Area
- Cylinder Surface Area
- Pythagorean Theorem
- Law of Large Numbers
- Irrational Number sqrt(2)
- Exponential Growth vs Linear Growth

### What It Stores

After a user completes the assessment, the planner saves the latest result in the browser so the user can reopen the learning plan later without retaking the quiz.

### Planner Entry

- Open `learning-plan.html` from the homepage navigation bar
- Complete the questionnaire
- Generate the plan
- Use **View Last Saved Plan** to reopen the latest saved result

## 📋 Usage Examples

### Example 1: Simple Equation

**Problem**: `Solve the linear equation: 3x - 7 = 11`

1. AI identifies this as a linear equation problem
2. It shows a solution approach such as "Rearrange" → "Combine like terms" → "Solve for x"
3. It guides the user through each step
4. It verifies the correctness of each step

### Example 2: Pythagorean Theorem

**Problem**: `A right triangle has legs of length 3 and 4. Find the hypotenuse.`

AI will:
- Identify this as a Pythagorean theorem problem
- Show steps such as Identify sides → Apply Pythagorean theorem → Calculate
- Allow different ways to express answers, such as `c² = 25` or `c = 5`

## 🔧 Technical Details

### Architecture

```
problem-solver.html (UI Structure)
    ↓
problem-solver.css (Visual Design)
    ↓
problem-solver.js (Logic and API Calls)
    ↓
Hugging Face API (AI Inference)
```

### Workflow

```
User inputs problem or uploads image
    ↓
Frontend organizes problem + completed steps
    ↓
User submits next step
    ↓
AI judges whether the step is correct
    ↓
Correct: move to next step; Wrong: retry and optionally show answer
    ↓
Until the problem is complete, show the summary
```

### API Integration

- **API Provider**: Hugging Face
- **Models**: `CohereLabs/tiny-aya-global:cohere` with fallback models
- **Format**: JSON-formatted prompts for structured responses
- **Storage**: API token managed server-side via `HF_API_TOKEN`
- **Vercel Routes**: `api/hf.js`, `api/health.js`
- **Inference Endpoint**: `https://router.huggingface.co/v1/chat/completions`

## 🎓 Educational Advantages

1. **Personalized Learning** - AI adjusts feedback based on the user's steps
2. **Immediate Feedback** - Each step receives validation and explanation
3. **Progressive Difficulty** - Hints can escalate progressively
4. **Diverse Topics** - Supports problems from various math domains
5. **Free to Use** - No hidden costs

## 🛠️ Troubleshooting

### Connection Failed

- Check whether `/api/health` is accessible
- Verify that `HF_API_TOKEN` is configured
- Ensure the network connection is working

### AI Response Format Incorrect

- This may happen if AI returns an unexpected format
- Try resubmitting with slightly different wording

### Token Problems

- Hugging Face tokens do not expire, but if it stops working:
  1. Regenerate the token in the Hugging Face dashboard
  2. Update the server environment variable `HF_API_TOKEN`
  3. Redeploy on Vercel or restart the local service

## 📁 File Structure

```
circle-area-animation/
├── index.html                    (Homepage)
├── learning-plan.html            (AI learning planner)
├── learning-plan.css             (Planner styles)
├── learning-plan.js              (Planner logic)
├── problem-solver.html           (Problem solver page)
├── problem-solver.css            (Dedicated styles)
├── problem-solver.js             (Core logic)
├── .env                          (Local environment variables)
├── api/
│   ├── health.js                 (Health check)
│   └── hf.js                    (Hugging Face proxy)
└── ...(Other existing modules)
```

## 🔐 Privacy and Security

- The API token is stored only in server environment variables and is not exposed to the frontend
- The frontend only calls the local backend API (`/api/hf`)
- All problems and answers are processed only on the client side

## 💡 Tips

- Complex problems may require multiple API adjustments
- If AI cannot understand your problem, try clearer wording
- Try different math domains: algebra, geometry, calculus, statistics, and more

## 🚧 Future Feature Plans

- [ ] Save problem-solving history
- [ ] Problem difficulty level classification
- [ ] Practice statistics and progress tracking
- [ ] Support multiple AI model options
- [ ] Local AI model support (offline)

---

**Version**: 1.1  
**Last Updated**: April 2, 2026  
**Developer**: Education 4.0 Team

🎯 **Happy learning!**
