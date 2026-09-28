# YouTube Downloader

A web app where users paste a YouTube video URL, see all available formats (video resolutions + audio), pick one, and download it to their device.

## How It Works

1. **Paste a URL** — user enters any YouTube video link (watch, shorts, youtu.be, embed).
2. **Get formats** — the backend uses `yt-dlp` to fetch video metadata (title, thumbnail, channel, duration) and scans all available streams to build a list of download options:
   - **Video + Audio** — every available resolution (e.g. 1080p, 720p, 480p, 360p). Higher resolutions that are split into separate video/audio DASH streams are automatically merged with ffmpeg.
   - **Audio only** — M4A (original quality) or MP3 (192 kbps, converted via ffmpeg).
3. **Download** — user clicks a format, the backend downloads it to a temp file, streams it to the browser as a file download, then cleans up the temp file. The file saves directly to the user's local storage.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + Vite 6 | UI — URL input, video info card, format list, download buttons |
| **Backend** | Python + FastAPI | REST API — `/api/formats` (get info), `/api/download` (stream file), `/api/health` |
| **Downloader** | yt-dlp | Extracts video metadata and downloads streams from YouTube |
| **Media processing** | ffmpeg | Merges split video/audio streams, converts to MP3 |
| **Dev environment** | Docker Compose | Two containers (backend + frontend) with live reload |
| **Production** | Docker (single image) | Frontend built and served by the backend as static files |

## Project Structure

```
.
├── backend/
│   ├── main.py              # FastAPI app — all API endpoints
│   ├── requirements.txt     # Python dependencies
│   └── Dockerfile           # Backend dev image (ffmpeg + pip deps)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main UI component
│   │   ├── App.css          # Styling (dark theme)
│   │   ├── main.jsx         # React entry point
│   │   └── index.css        # Global styles
│   ├── index.html           # HTML template
│   ├── vite.config.js       # Vite config + dev proxy to backend
│   └── package.json         # Node dependencies
├── Dockerfile               # Production multi-stage build (frontend + backend → 1 image)
├── railway.json             # Railway deployment config
└── README.md
```

## Local Development

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### Run without Docker

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
> Requires `ffmpeg` installed on your system (`brew install ffmpeg` / `apt install ffmpeg`).

**Frontend** (in a separate terminal):
```bash
cd frontend
npm install
npm run dev
```

## Deployment

### Option 1: Deploy together as a single container (recommended for Railway)

The root `Dockerfile` is a multi-stage build that:
1. Builds the React frontend with Vite → `dist/`
2. Installs Python + ffmpeg + backend dependencies
3. Copies the frontend `dist/` into the backend's `static/` directory
4. Runs a single `uvicorn` server that serves both the API and the frontend

**On Railway:**
1. Go to [railway.app](https://railway.app) and create a new project.
2. Connect your GitHub repo.
3. Railway auto-detects the `Dockerfile` and `railway.json` — no extra config needed.
4. Railway sets the `PORT` env var automatically; the app listens on it.
5. Deploy — you get a single URL that serves the UI and API together.

**On any Docker host:**
```bash
docker build -t yt-downloader .
docker run -p 8000:8000 yt-downloader
```
Then visit `http://localhost:8000`.

### Option 2: Deploy frontend and backend separately

**Backend (FastAPI):**
- Use `backend/Dockerfile` as the build context.
- Deploy to Railway, Fly.io, Render, or any container host.
- Expose port 8000 (or whatever `PORT` the platform sets).

**Frontend (static build):**
```bash
cd frontend
npm install
npm run build    # outputs to dist/
```
- Serve the `dist/` folder with any static host (Vercel, Netlify, Cloudflare Pages, nginx).
- Set the API URL: either configure the static host to proxy `/api` to the backend URL, or update `vite.config.js` / API calls to point to the backend's public URL.

> When deployed separately, make sure CORS is configured (the backend already allows all origins) and that the frontend can reach the backend's public URL.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check — returns `{"status": "ok"}` |
| `POST` | `/api/formats` | Body: `{"url": "..."}` — returns video info + available formats |
| `GET` | `/api/download?url=...&quality=...` | Downloads the video in the selected quality. `quality` can be `video_1080`, `video_720`, `audio_m4a`, `audio_mp3`, etc. |

## Notes

- No API keys or credentials needed — yt-dlp accesses YouTube directly.
- Downloads use temp files that are automatically cleaned up after streaming.
- YouTube may block requests from datacenter IPs (cloud servers). If downloads fail on Railway, this is a YouTube-side restriction, not a bug.
- Downloading copyrighted content may violate YouTube's Terms of Service — use responsibly.
