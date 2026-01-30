# 喫茶 KISSA - Online Record Collection 💿

**Kissa** is a full-stack application designed to digitize, curate, and play a vinyl collection instantly.
It bridges the gap between the physical digging experience and digital convenience.

By snapping a photo of a record cover or a center label, the app identifies the album, retrieves deep metadata (Discogs) and audio,
and allows you to organize your collection like a professional selector.

**New in v2:** "Selector Toolkit" featuring Mood Tags, Focus Tracks, and specialized 45RPM/Single detection.

![Status](https://img.shields.io/badge/Status-v2.0%20Live-success)
![Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20FastAPI%20%7C%20Supabase-blue)

## ✨ Features

### 👁️ Visual Scan
* **Deep Identification**: Identifies LPs, EPs, and **7-inch Singles** (45 RPM) by analyzing covers or reading circular center labels directly.
* **Visual Reasoning**: The AI understands visual hierarchy.

### 🎛️ Sorting
* **Mood & Energy Tags**: Organize records by "Vibe" using customizable color-coded stickers (e.g., 🔴 Peak Time, 🔵 Deep, 🟢 Organic).
* **Focus Tracks**: Mark specific "Key Tracks" on an album to highlight why it's in your bag.
* **Smart Filtering**: Filter your collection by Genre AND Vibe simultaneously (e.g., "Show me all *Deep* *Jazz* records").
* **Inventory Management**: Track storage location ("Bin A", "Shelf 2"), condition, price paid, and purchase history.

### 🗄️ Digital Crate Digging
* **Hybrid Search**: Manual fallback searches both **Spotify** (Audio) and **Discogs** (Physical Data) in parallel.
* **Instant Playback**: "Listen" button integrated.

## 🏗️ Architecture & AI Pipeline

The app relies on a decoupled architecture (Vercel Frontend / Render Backend) with a specialized vision pipeline:

1.  **Input**: User captures a photo.
2.  **Vision (Google Cloud)**: extracts raw entities, text (OCR), and dominant colors.
3.  **LLM-Reasoning (GPT-4o)**: An AI Agent performs a "Chain of Thought" analysis:
    * *Format Detection*: Is it a Cover or a Center Label?
    * *Typography Separation*: Dissociates Artist names from Logos/Slogans.
    * *Noise Filtering*: Ignores "Stereo", "Hi-Fi", etc.
4.  **Data Fetch**:
    * **Discogs**: For precise physical metadata (Year, Labels, Cats).
    * **Spotify**: For streaming links and audio features.
5.  **Storage (Supabase)**: Persists the "Digital Twin" of the record.

## 🛠️ Tech Stack

### Frontend
* **Framework**: Next.js 14 (App Router)
* **Language**: TypeScript
* **Styling**: Tailwind CSS
* **State**: React Context (Moods, Player)

### Backend (API)
* **Framework**: FastAPI (Python 3.10+)
* **AI**: OpenAI API (GPT-4o), Google Cloud Vision
* **Integrations**: Spotipy (Spotify), Discogs Client
* **Server**: Uvicorn / Render

### Database
* **DBMS**: Supabase (PostgreSQL) with JSONB support for dynamic config.

---

## 🚀 Roadmap

* [x] **Forensic Scanning** (Handle 45s & OSTs)
* [x] **Selector Mode** (Moods & Focus Tracks)
* [x] **Remote Control** (Device Sync)
* [x] **Discogs Bridge**: One-click import of your existing Discogs collection.
* [ ] **Barcode Scanner**: Hybrid mode for modern releases.

---

## MIT License

Copyright (c) 2024-2025 Kissa Project

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
