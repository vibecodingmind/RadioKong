"use client";

import { useState } from "react";
import { useAudioStore } from "@/lib/audio-store";
import { useAudioEngine } from "@/lib/use-audio-engine";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StreamSettings() {
  const { streamConnection, setStreamConnection, streamHealth, isLive } = useAudioStore();
  const { testConnection } = useAudioEngine();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testConnection();
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = () => {
    // Settings are auto-saved via the useAudioEngine hook
    // This button provides explicit feedback
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 text-xs">
      {/* Server Type */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Server Type</Label>
        <Select
          value={streamConnection.serverType}
          onValueChange={(v) => setStreamConnection({ serverType: v as "icecast" | "shoutcast" })}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="icecast">Icecast</SelectItem>
            <SelectItem value="shoutcast">SHOUTcast</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Host & Port */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1">
          <Label className="text-[10px] text-muted-foreground">Host</Label>
          <Input
            className="h-7 text-xs"
            placeholder="localhost"
            value={streamConnection.host}
            onChange={(e) => setStreamConnection({ host: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Port</Label>
          <Input
            className="h-7 text-xs"
            type="number"
            placeholder="8000"
            value={streamConnection.port}
            onChange={(e) => setStreamConnection({ port: parseInt(e.target.value) || 8000 })}
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Password</Label>
        <Input
          className="h-7 text-xs"
          type="password"
          placeholder="••••••••"
          value={streamConnection.password}
          onChange={(e) => setStreamConnection({ password: e.target.value })}
        />
      </div>

      {/* Mount Point */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Mount Point</Label>
        <Input
          className="h-7 text-xs"
          placeholder="/live"
          value={streamConnection.mount}
          onChange={(e) => setStreamConnection({ mount: e.target.value })}
        />
      </div>

      {/* Codec */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Codec</Label>
        <Select
          value={streamConnection.codec}
          onValueChange={(v) => setStreamConnection({ codec: v as "mp3" | "ogg" | "aac" | "opus" | "flac" })}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mp3">MP3</SelectItem>
            <SelectItem value="ogg">OGG Vorbis</SelectItem>
            <SelectItem value="aac">AAC</SelectItem>
            <SelectItem value="opus">Opus</SelectItem>
            <SelectItem value="flac">FLAC</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bitrate */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Bitrate</Label>
        <Select
          value={String(streamConnection.bitrate)}
          onValueChange={(v) => setStreamConnection({ bitrate: parseInt(v) as 64 | 96 | 128 | 192 | 256 | 320 })}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="64">64 kbps</SelectItem>
            <SelectItem value="96">96 kbps</SelectItem>
            <SelectItem value="128">128 kbps</SelectItem>
            <SelectItem value="192">192 kbps</SelectItem>
            <SelectItem value="256">256 kbps</SelectItem>
            <SelectItem value="320">320 kbps</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Auto-reconnect */}
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground">Auto-reconnect</Label>
        <Switch
          checked={streamConnection.autoReconnect}
          onCheckedChange={(checked) => setStreamConnection({ autoReconnect: checked })}
        />
      </div>

      {/* Test Connection */}
      <Button
        size="sm"
        variant="outline"
        className="w-full h-7 text-xs"
        onClick={handleTestConnection}
        disabled={testing || isLive}
      >
        {testing ? "Testing..." : "Test Connection"}
      </Button>

      {/* Test result */}
      {testResult && (
        <div
          className={`text-[10px] px-2 py-1.5 rounded-md ${
            testResult.success
              ? "bg-rk-green/10 text-rk-green border border-rk-green/30"
              : "bg-rk-red/10 text-rk-red border border-rk-red/30"
          }`}
        >
          {testResult.message}
        </div>
      )}

      {/* Save Config */}
      <Button
        size="sm"
        variant="outline"
        className="w-full h-7 text-xs"
        onClick={handleSave}
      >
        {saved ? "✓ Settings Saved" : "Save Settings"}
      </Button>

      {/* Connect / Disconnect */}
      <Button
        size="sm"
        className={`w-full h-8 text-xs font-semibold ${
          streamHealth.connected
            ? "bg-rk-red hover:bg-rk-red/90 text-white"
            : "bg-rk-green hover:bg-rk-green/90 text-white"
        }`}
        disabled={!isLive}
      >
        {streamHealth.connected ? "Disconnect" : "Connect"}
      </Button>

      {/* Relay server note */}
      <p className="text-[9px] text-muted-foreground leading-relaxed">
        Streaming requires the relay server on port 3001. Run: <code className="bg-secondary px-1 rounded">node relay-server.mjs</code>
      </p>
    </div>
  );
}
