import { useState } from 'react'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(null)
  const [error, setError] = useState('')
  const [videoInfo, setVideoInfo] = useState(null)

  const handleFetch = async (e) => {
    e?.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError('')
    setVideoInfo(null)
    try {
      const res = await fetch('/api/formats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to fetch video info')
      setVideoInfo(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (quality) => {
    setDownloading(quality)
    setError('')
    try {
      const res = await fetch(
        `/api/download?url=${encodeURIComponent(url.trim())}&quality=${quality}`
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Download failed')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition')
      let filename = 'download'
      if (disposition) {
        const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
        if (match) filename = decodeURIComponent(match[1])
      }
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      setError(err.message)
    } finally {
      setDownloading(null)
    }
  }

  const formatDuration = (s) => {
    if (!s) return ''
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const formatViews = (v) => {
    if (!v) return ''
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M views`
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K views`
    return `${v} views`
  }

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <div className="logo">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8z" fill="#FF0000"/>
              <path d="M9.5 15.5l6-3.5-6-3.5v7z" fill="#fff"/>
            </svg>
            <h1>YouTube Downloader</h1>
          </div>
          <p className="subtitle">Paste a YouTube URL and download in your preferred format</p>
        </header>

        <form className="input-section" onSubmit={handleFetch}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="url-input"
            disabled={loading}
          />
          <button type="submit" className="fetch-btn" disabled={loading || !url.trim()}>
            {loading ? 'Fetching...' : 'Get Formats'}
          </button>
        </form>

        {error && <div className="error-msg">{error}</div>}

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p>Fetching video information...</p>
          </div>
        )}

        {videoInfo && (
          <div className="results">
            <div className="video-info">
              <img src={videoInfo.thumbnail} alt="thumbnail" className="thumbnail" />
              <div className="video-details">
                <h2>{videoInfo.title}</h2>
                <div className="video-meta">
                  {videoInfo.uploader && <span>{videoInfo.uploader}</span>}
                  {videoInfo.duration && <span>• {formatDuration(videoInfo.duration)}</span>}
                  {videoInfo.view_count != null && (
                    <span>• {formatViews(videoInfo.view_count)}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="formats-section">
              <h3>Available Formats</h3>
              <div className="formats-list">
                {videoInfo.formats.map((fmt) => (
                  <div key={fmt.id} className="format-card">
                    <div className="format-info">
                      <span className="format-label">{fmt.label}</span>
                      <span className={`format-type ${fmt.type}`}>
                        {fmt.type === 'video' ? 'Video + Audio' : 'Audio Only'}
                      </span>
                    </div>
                    <button
                      className="download-btn"
                      onClick={() => handleDownload(fmt.id)}
                      disabled={downloading !== null}
                    >
                      {downloading === fmt.id ? (
                        <>
                          <div className="btn-spinner" /> Downloading...
                        </>
                      ) : downloading !== null ? (
                        'Please wait...'
                      ) : (
                        'Download'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
