"use client";

import { useAudioStore } from "@/lib/audio-store";
import { useAudioEngine } from "@/lib/use-audio-engine";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function MetadataPanel() {
  const { metadata, setMetadata, isLive } = useAudioStore();
  const { sendMetadata } = useAudioEngine();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!isLive) return;
    setSending(true);
    setError(null);

    try {
      const success = await sendMetadata();
      if (success) {
        setSent(true);
        setTimeout(() => setSent(false), 2000);
      } else {
        setError("Failed to update metadata — check server connection");
        setTimeout(() => setError(null), 4000);
      }
    } catch (err: any) {
      setError(err.message || "Metadata update failed");
      setTimeout(() => setError(null), 4000);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 text-xs">
      {/* Now Playing display */}
      <div className="bg-secondary/30 rounded-md p-3">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Now Playing</span>
        <p className="text-sm font-medium mt-1 truncate">
          {metadata.artist && metadata.title
            ? `${metadata.artist} — ${metadata.title}`
            : metadata.title || metadata.artist || "No metadata"}
        </p>
      </div>

      {/* Title */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Title</Label>
        <Input
          className="h-7 text-xs"
          placeholder="Song or show title"
          value={metadata.title}
          onChange={(e) => setMetadata({ title: e.target.value })}
        />
      </div>

      {/* Artist */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Artist</Label>
        <Input
          className="h-7 text-xs"
          placeholder="Artist name"
          value={metadata.artist}
          onChange={(e) => setMetadata({ artist: e.target.value })}
        />
      </div>

      {/* Send metadata */}
      <Button
        size="sm"
        className={`w-full h-8 text-xs font-semibold ${
          sent
            ? "bg-rk-green hover:bg-rk-green/90 text-white"
            : "bg-rk-purple hover:bg-rk-purple/90 text-white"
        }`}
        onClick={handleSend}
        disabled={!isLive || sending}
      >
        {sending ? "Sending..." : sent ? "✓ Metadata Sent" : "Send Metadata"}
      </Button>

      {/* Error display */}
      {error && (
        <div className="text-[10px] px-2 py-1.5 rounded-md bg-rk-red/10 text-rk-red border border-rk-red/30">
          {error}
        </div>
      )}

      {/* Auto-update toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground">Auto-update from file tags</Label>
        <Switch
          checked={metadata.autoUpdate}
          onCheckedChange={(checked) => setMetadata({ autoUpdate: checked })}
        />
      </div>
    </div>
  );
}
