"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  getRecordings,
  deleteRecording,
  downloadRecording,
  formatDuration,
  formatBytes,
  type Recording,
} from "@/lib/recorder";
import { Button } from "@/components/ui/button";

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadRecordings();
  }, []);

  async function loadRecordings() {
    setLoading(true);
    try {
      const recs = await getRecordings();
      setRecordings(recs);
    } catch (err) {
      console.error("Failed to load recordings:", err);
    } finally {
      setLoading(false);
    }
  }

  function handlePlay(rec: Recording) {
    if (playing === rec.id) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlaying(null);
      return;
    }

    // Stop previous
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const url = URL.createObjectURL(rec.blob);
    const audio = new Audio(url);
    audio.onended = () => {
      setPlaying(null);
      URL.revokeObjectURL(url);
    };
    audio.play();
    audioRef.current = audio;
    setPlaying(rec.id);
  }

  async function handleDelete(id: string) {
    try {
      await deleteRecording(id);
      if (playing === id && audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setPlaying(null);
      }
      setRecordings((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Failed to delete recording:", err);
    }
  }

  function handleDownload(rec: Recording) {
    downloadRecording(rec);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center h-12 px-4 border-b border-border bg-card shrink-0 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-rk-purple flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight">
            Radio<span className="text-rk-purple">Kong</span>
          </span>
        </div>
        <span className="text-muted-foreground text-xs">/ Recordings</span>
        <div className="flex-1" />
        <Link href="/">
          <Button variant="outline" size="sm" className="h-7 text-xs">
            Back to Studio
          </Button>
        </Link>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Recordings</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {recordings.length} recording{recordings.length !== 1 ? "s" : ""} saved
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadRecordings} className="h-7 text-xs">
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading recordings...</div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <p className="text-sm font-medium">No recordings yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Hit the REC button while streaming to start recording
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recordings.map((rec) => (
              <div
                key={rec.id}
                className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                  playing === rec.id
                    ? "border-rk-purple bg-rk-purple/5"
                    : "border-border bg-card hover:bg-secondary/30"
                }`}
              >
                {/* Play/Pause button */}
                <button
                  onClick={() => handlePlay(rec)}
                  className="w-10 h-10 rounded-full bg-rk-purple hover:bg-rk-purple/90 flex items-center justify-center shrink-0 transition-colors"
                >
                  {playing === rec.id ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  )}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{rec.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {rec.artist} &middot; {formatDate(rec.date)}
                  </p>
                </div>

                {/* Stats */}
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono">{formatDuration(rec.duration)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatBytes(rec.size)}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDownload(rec)}
                    title="Download"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7,10 12,15 17,10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-rk-red hover:text-rk-red"
                    onClick={() => handleDelete(rec.id)}
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3,6 5,6 21,6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
