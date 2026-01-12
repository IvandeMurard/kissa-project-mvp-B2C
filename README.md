# 喫茶 KISSA - AI Vinyl Companion 💿

**Kissa** is a full-stack application designed to digitize and manage a vinyl collection instantly. By simply snapping a photo of a record cover, the app identifies the album using a hybrid AI pipeline, retrieves metadata (Discogs), streaming links (Spotify), and saves everything to a personal cloud library.

**New:** Now featuring **Zero UI** capabilities compatible with iOS Siri & Action Button for "blind" inventory checks.

![Status](https://img.shields.io/badge/Status-MVP%20Live-success)
![Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20FastAPI%20%7C%20Supabase-blue)

## ✨ Features

* **Smart Visual Scan**: Identify albums via mobile camera (handles glare and complex covers).
* **Advanced AI Pipeline**: Combines **Google Vision** (Web Entities + OCR) with **LLM Reasoning (GPT-4o)** to clean and contextualize raw data before searching.
* **Zero UI / Headless Mode**:
    * **Siri Support**: "Hey Siri, do I own 'Daft Punk - Discovery'?"
    * **Haptic Check**: Use the iPhone Action Button to scan a record and receive a vibration feedback (1 buzz = Owned, 2 buzzes = New).
* **Manual Search**: Fallback for obscure records.
* **Cloud Library**: Persistent storage of albums, artists, years, and tracklists via Supabase.
* **Streaming Integration**: Direct Spotify playback links.

## 🏗️ Architecture & Vision Pipeline

The app relies on a decoupled architecture (Vercel Frontend / Render Backend):

1.  **Input**: User sends a photo (Web App or iOS Shortcut).
2.  **Vision (Google Cloud)**: Image analysis (Web Detection + Text Detection).
3.  **Reasoning (OpenAI GPT-4o)**: An AI Agent analyzes raw OCR data to separate "noise" (e.g., "Stereo", "LP") from useful info (Artist, Title).
4.  **Metadata (Discogs)**: Precise search based on cleaned data.
5.  **Enrichment (Spotify)**: Retrieval of streaming links.
6.  **Storage (Supabase)**: PostgreSQL database operations.

## 🛠️ Tech Stack

### Frontend
* **Framework**: Next.js 14 (App Router)
* **Language**: TypeScript
* **Styling**: Tailwind CSS
* **Hosting**: Vercel

### Backend (API)
* **Framework**: FastAPI (Python 3.10+)
* **AI & Data**: Google Cloud Vision, OpenAI API, Discogs Client, Spotipy
* **Server**: Uvicorn
* **Hosting**: Render

### Database
* **DBMS**: Supabase (PostgreSQL)

---

## MIT License

Copyright (c) 2024 Kissa Project

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
