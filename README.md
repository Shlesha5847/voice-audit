# Voice Audit — AI Call Quality & QA Review Platform

A modern, multi-tenant AI voice audit platform built with **Next.js (App Router)**, **Deepgram Nova-3**, **Groq (120B LLM)**, and **Supabase (Storage + PostgreSQL)**. 

Designed for quality assurance trainers, compliance officers, and sales managers to automatically transcribe, evaluate, and audit customer support and sales calls against custom weighted rubrics.

---

## 🚀 Key Features

* **Multi-Tenant Isolation**: Complete bank-level data isolation (e.g. `bank_1` vs `bank_2`).
* **Cloud Audio Storage**: Direct MP3/WAV uploads to Supabase Storage with streaming URLs.
* **Timestamped Transcription**: Deepgram Nova-3 speech-to-text with diarization and `[MM:SS]` utterance timestamps.
* **Custom Dynamic Rubrics**: Configure custom criteria and weights with strict $100\%$ total weight validation.
* **Calibrated LLM Judge**: Strict zero-temperature evaluator grounded in transcript evidence with timestamp citations and omission penalties.
* **Interactive Audio Seeking**: Click any evaluated criterion timestamp (`⏱ 00:45`) or transcript line to immediately seek the audio player to that exact moment.
* **Non-Technical Dashboard**: Minimalist UI with color-coded score indicators (`>8` Green, `5–8` Yellow, `<5` Red) and full call drilldowns.

---

## 🛠 Tech Stack

* **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack, React 19)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **Speech-to-Text**: [Deepgram Nova-3 API](https://deepgram.com/)
* **LLM Engine**: [Groq Cloud API](https://groq.com/) (`openai/gpt-oss-120b`)
* **Database & Storage**: [Supabase](https://supabase.com/) (PostgreSQL with `jsonb` & Storage buckets)

---

## ⚙️ Getting Started

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Shlesha5847/voice-audit.git
cd voice-audit
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
DEEPGRAM_API_KEY=<your-deepgram-api-key>
GROQ_API_KEY=<your-groq-api-key>
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📋 Application Pages

* **`/`** — Call Reviews Dashboard (Call list, score badges, "+ Audit New Call" modal).
* **`/calls/[id]`** — Call Details (Interactive audio player, final score, criteria breakdown with clickable timestamp seek, and dialogue transcript).
* **`/rubrics`** — Rubric Manager (Create, edit, delete custom weighted rubrics with quick-fill templates).

---

## 🔌 Core API Routes

| Route | Method | Description |
| :--- | :---: | :--- |
| **`/api/upload`** | `POST` | Uploads audio recording buffer to Supabase Storage. |
| **`/api/transcribe`** | `POST` | Calls Deepgram Nova-3 to produce timestamped transcript segments. |
| **`/api/score`** | `POST` | Runs LLM Judge against transcript & rubric, stores result in DB. |
| **`/api/calls`** | `GET` | Lists all audited calls filtered by `tenantId`. |
| **`/api/calls/[id]`** | `GET` | Fetches single call, transcript, score result, and rubric details. |
| **`/api/rubrics`** | `GET` | Lists rubrics filtered by `tenantId`. |
| **`/api/rubrics/create`** | `POST` | Creates a new rubric with 100% total weight validation. |
| **`/api/rubrics/update`** | `POST`/`PUT` | Updates rubric title and criteria JSONB. |
| **`/api/rubrics/delete`** | `DELETE` | Deletes a rubric scoped strictly to `tenantId`. |

---

## 🚢 Deployment to Vercel

1. Push your repository to GitHub.
2. Import the repository into **[Vercel](https://vercel.com/)**.
3. Add the 4 environment variables from `.env` in the Vercel project settings.
4. Click **Deploy**.
