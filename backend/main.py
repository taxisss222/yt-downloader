import os
import re
import tempfile
import shutil

import yt_dlp
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="YouTube Downloader")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

YOUTUBE_PATTERNS = [
    r"(https?://)?(www\.)?youtube\.com/watch\?v=",
    r"(https?://)?(www\.)?youtu\.be/",
    r"(https?://)?(www\.)?youtube\.com/shorts/",
    r"(https?://)?(www\.)?youtube\.com/embed/",
]


class URLRequest(BaseModel):
    url: str


def is_valid_youtube_url(url: str) -> bool:
    return any(re.match(p, url) for p in YOUTUBE_PATTERNS)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/formats")
def get_formats(req: URLRequest):
    if not is_valid_youtube_url(req.url):
        raise HTTPException(status_code=400, detail="Please enter a valid YouTube URL")

    ydl_opts = {"quiet": True, "no_warnings": True, "skip_download": True}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(req.url, download=False)
    except yt_dlp.utils.DownloadError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Collect available video resolutions
    heights = set()
    for f in info.get("formats", []):
        if f.get("vcodec", "none") != "none" and f.get("height"):
            heights.add(f["height"])

    formats = []
    for h in sorted(heights, reverse=True):
        formats.append(
            {
                "id": f"video_{h}",
                "label": f"{h}p",
                "type": "video",
                "ext": "mp4",
            }
        )

    formats.append({"id": "audio_m4a", "label": "Audio (M4A)", "type": "audio", "ext": "m4a"})
    formats.append({"id": "audio_mp3", "label": "Audio (MP3)", "type": "audio", "ext": "mp3"})

    return {
        "title": info.get("title", ""),
        "thumbnail": info.get("thumbnail", ""),
        "duration": info.get("duration"),
        "uploader": info.get("uploader", ""),
        "view_count": info.get("view_count"),
        "formats": formats,
    }


@app.get("/api/download")
def download(url: str, quality: str, background_tasks: BackgroundTasks):
    if not is_valid_youtube_url(url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    temp_dir = tempfile.mkdtemp()

    ydl_opts = {
        "outtmpl": os.path.join(temp_dir, "%(title)s.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "restrictfilenames": True,
    }

    if quality == "audio_m4a":
        ydl_opts["format"] = "bestaudio[ext=m4a]/bestaudio"
    elif quality == "audio_mp3":
        ydl_opts["format"] = "bestaudio/best"
        ydl_opts["postprocessors"] = [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ]
    elif quality.startswith("video_"):
        h = quality.replace("video_", "")
        ydl_opts["format"] = f"bestvideo[height<={h}]+bestaudio/best[height<={h}]"
        ydl_opts["merge_output_format"] = "mp4"
    else:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="Invalid quality option")

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    except yt_dlp.utils.DownloadError as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(e))

    files = os.listdir(temp_dir)
    if not files:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="Download failed — no file produced")

    filepath = os.path.join(temp_dir, files[0])
    filename = files[0]

    background_tasks.add_task(shutil.rmtree, temp_dir, True)

    return FileResponse(filepath, filename=filename, media_type="application/octet-stream")


# Serve frontend static files (production / Railway single-container deploy)
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
