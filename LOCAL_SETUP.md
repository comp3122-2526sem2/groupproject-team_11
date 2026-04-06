# Local Development Setup Guide

This guide walks you through running the **Math Exploration Hub** project on your local machine.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone the Repository](#2-clone-the-repository)
3. [Environment Variables](#3-environment-variables)
4. [Install Vercel CLI](#4-install-vercel-cli)
5. [Run the Development Server](#5-run-the-development-server)
6. [Access the Application](#6-access-the-application)
7. [Project Structure](#7-project-structure)
8. [Important Notes](#8-important-notes)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

Make sure you have the following installed on your machine:

| Tool       | Version  | Installation                                 |
| ---------- | -------- | -------------------------------------------- |
| **Node.js** | >= 18.x  | [https://nodejs.org/](https://nodejs.org/)   |
| **npm**     | >= 9.x   | Comes with Node.js                           |
| **Python**  | >= 3.9   | [https://www.python.org/](https://www.python.org/) |
| **Git**     | Latest   | [https://git-scm.com/](https://git-scm.com/) |

> **VPN Requirement**: A VPN connection is required to access the **Google Gemini API** if you are located in a region where Gemini is not available (e.g., Hong Kong, mainland China). Please connect to a VPN (routed through the US, Japan, or another supported region) **before** starting the development server or testing AI generation features.

---

## 2. Clone the Repository

```bash
git clone <repository-url>
cd comp3122_genEducation
```

Replace `<repository-url>` with the actual Git remote URL of this project.

---

## 3. Environment Variables

The project requires environment variables to connect to external APIs. A template is provided:

```bash
cp .env.example .env
```

Then open `.env` and fill in the required values:

```env
# Google Gemini API Key
# Get one from: https://aistudio.google.com/apikey
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

# Hugging Face API Token (optional, for HF inference features)
# Get one from: https://huggingface.co/settings/tokens
HF_API_TOKEN=YOUR_HUGGINGFACE_TOKEN_HERE
```

> **Note**: If you already have a `.env.local` file pulled via `vercel env pull`, it will also be loaded automatically. The `.env.local` file takes precedence over `.env`.

---

## 4. Install Vercel CLI

This project uses **Vercel Serverless Functions** (Python) as the backend proxy. To run the full stack locally (frontend + API), you need the Vercel CLI:

```bash
npm install -g vercel
```

After installation, link the project (only needed once):

```bash
vercel link
```

Follow the prompts to link to the existing Vercel project.

> **Tip**: If you have already been added to the Vercel team, running `vercel env pull` will automatically download the environment variables into `.env.local`.

---

## 5. Run the Development Server

Start the local development server with:

```bash
vercel dev
```

This will:

- Serve static files from the `public/` directory
- Spin up the Python serverless function at `api/index.py`
- Proxy API routes (e.g., `/api/gemini`, `/api/gemini-key`) to the Python handler

The server will start on **http://localhost:3000** by default.

> ⚠️ **VPN Reminder**: Make sure your VPN is connected before using any AI question generation features. The backend proxy calls the Google Gemini API, which is region-restricted. Without a VPN, you will encounter a **"User location is not supported"** error.

---

## 6. Access the Application

Open your browser and navigate to:

```
http://localhost:3000
```

### Key Pages

| Page                      | URL Path                         |
| ------------------------- | -------------------------------- |
| Home (Module Selector)    | `/`                              |
| Exponential Functions     | `/pages/exponential.html`        |
| Pythagorean Theorem       | `/pages/pythagoras.html`         |
| Circle Properties         | `/pages/circle.html`             |
| Cylinder Visualisation    | `/pages/cylinder.html`           |
| Probability               | `/pages/probability.html`        |
| Irrational Number √2      | `/pages/sqrt2.html`              |
| DSE Algebra Generator     | `/pages/dse-algebra.html`        |
| DSE Geometry Generator    | `/pages/dse-geometry.html`       |
| My Problems Library       | `/pages/my-problems.html`        |

---

## 7. Project Structure

```
comp3122_genEducation/
├── api/
│   └── index.py              # Python serverless function (Gemini proxy)
├── database/
│   └── schema.sql             # Supabase PostgreSQL schema
├── docs/                      # Project documentation
├── public/                    # Static frontend (served as root)
│   ├── index.html             # Home page
│   ├── css/
│   │   ├── common.css         # Shared styles
│   │   ├── dse-algebra.css    # Algebra generator styles
│   │   ├── dse-geometry.css   # Geometry generator styles
│   │   └── my-problems.css    # Problem library styles
│   ├── js/
│   │   ├── shared/
│   │   │   ├── supabase-config.js   # Supabase client init
│   │   │   ├── db-service.js        # Database CRUD operations
│   │   │   ├── auth-guard.js        # Student ID authentication
│   │   │   ├── i18n.js              # Internationalization (ZH/EN)
│   │   │   └── mobile-nav.js        # Mobile navigation
│   │   ├── generators/
│   │   │   ├── dse-algebra.js       # AI algebra question generator
│   │   │   ├── dse-geometry.js      # AI geometry question generator
│   │   │   └── my-problems.js       # Saved problems manager
│   │   └── animations/             # Interactive math visualizations
│   └── pages/                      # Sub-pages (modules)
├── .env.example               # Environment variable template
├── vercel.json                # Vercel deployment configuration
└── .gitignore
```

---

## 8. Important Notes

### 🔐 VPN is Required for Gemini API

The project uses **Google Gemini API** (`gemini-3-flash-preview`) for AI-powered question generation. This API is **region-restricted** and not available in certain locations (e.g., Hong Kong, mainland China).

**You must connect to a VPN** routed through a supported region (US, Japan, Europe, etc.) when:

- Running the local development server with `vercel dev`
- Testing the DSE Algebra or DSE Geometry generators
- Any feature that calls the `/api/gemini` endpoint

Without a VPN, the Gemini API will return:
```json
{ "error": "User location is not supported for the API use." }
```

### 🗄️ Supabase Database

The project uses **Supabase** as its database backend. The Supabase connection is configured in `public/js/shared/supabase-config.js` with hardcoded project URL and anon key. No additional local database setup is required — the app connects directly to the hosted Supabase instance.

If you need to recreate the database schema, run the SQL in `database/schema.sql` via the [Supabase SQL Editor](https://supabase.com/dashboard).

### 🌐 No Build Step Required

This is a **static frontend** project. There is no bundler, no `npm install` for frontend dependencies, and no build step. All libraries (MathJax, Supabase SDK, jsPDF, etc.) are loaded via CDN `<script>` tags.

The only dependency that requires installation is the **Vercel CLI** (for running the Python backend locally).

---

## 9. Troubleshooting

### "User location is not supported" Error
**Cause**: Gemini API is region-restricted.
**Fix**: Connect to a VPN (US/Japan/Europe) and restart the dev server.

### `vercel dev` Fails to Start
**Cause**: Vercel CLI not installed or project not linked.
**Fix**:
```bash
npm install -g vercel
vercel link
vercel dev
```

### Python Function Not Working
**Cause**: Python not installed or wrong version.
**Fix**: Ensure Python 3.9+ is installed and available in your `PATH`:
```bash
python3 --version
```

### Environment Variables Not Loaded
**Cause**: Missing `.env` or `.env.local` file.
**Fix**: Copy the template and fill in your API keys:
```bash
cp .env.example .env
# Edit .env with your keys
```
Or pull from Vercel (if linked):
```bash
vercel env pull
```

### MathJax Not Rendering
**Cause**: Usually a browser cache issue.
**Fix**: Hard refresh with `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows).

### Supabase Connection Issues
**Cause**: Network issue or Supabase project paused.
**Fix**: Check that the Supabase project is active at [https://supabase.com/dashboard](https://supabase.com/dashboard). Free-tier projects auto-pause after 7 days of inactivity.

---

## Quick Start (TL;DR)

```bash
# 1. Clone and enter project
git clone <repository-url>
cd comp3122_genEducation

# 2. Set up environment variables
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 3. Install Vercel CLI
npm install -g vercel

# 4. Link project (first time only)
vercel link

# 5. Connect VPN (for Gemini API access)
# → Connect to US/Japan/Europe VPN node

# 6. Start dev server
vercel dev

# 7. Open browser
# → http://localhost:3000
```
