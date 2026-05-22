import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, PhoneCall, Upload, RefreshCcw, Play, Pause, Square, Wand2, Trash2 } from "lucide-react";

const TTS_VOICES = [
  // Female
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily — female, warm" },
  { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda — female, friendly" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah — female, professional" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice — female, clear British" },
  { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica — female, expressive" },
  { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura — female, upbeat" },
  { id: "FZkK3TvQ0pjyDmT8fzIW", label: "Bunty — male, Hindi/Hinglish 🇮🇳" },
  // Male
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George — male, authoritative" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel — male, news anchor" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam — male, energetic young" },
  { id: "nPczCjzI2devNBz1zQrb", label: "Brian — male, deep narrator" },
  { id: "cjVigY5qzO86Huf0OWal", label: "Eric — male, smooth American" },
  { id: "iP95p4xoKVk53GoZ742B", label: "Chris — male, casual friendly" },
  { id: "bIHbv24MWmeRgasZH58o", label: "Will — male, confident" },
  { id: "pqHfZKP75CvOlQylNhV4", label: "Bill — male, mature storyteller" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger — male, classic broadcaster" },
  { id: "IKne3meq5aSn9XLyUdCD", label: "Charlie — male, natural Australian" },
  { id: "N2lVS1w4EtoT3dr4eOWO", label: "Callum — male, intense British" },
];

type Voice = { id: string; prompt_id: string; file_name: string; prompt_category: string | null; prompt_status: number | null; is_active: boolean };
type Campaign = {
  id: string; campaign_id_external: string | null; campaign_name: string;
  template_id: number; status: string; scheduled_at: string | null; created_at: string;
};
type EventVoice = {
  event_key: string;
  voice_prompt_id: string | null;
  is_active: boolean;
  cooldown_hours: number;
  send_window_start: string;
  send_window_end: string;
  location_json: string;
  description: string | null;
};
type EventLog = {
  id: string; event_key: string; user_id: string | null; phone: string | null;
  voice_prompt_id: string | null; campaign_id_external: string | null;
  status: string; sent_at: string; response: any;
};

const EVENT_LABELS: Record<string, string> = {
  signup_welcome: "1. New Signup Welcome",
  onboarding_incomplete: "2. Onboarding Incomplete",
  inactive_24h: "3. Inactive within 24h",
  inactive_24h_plus: "4. Inactive 24h+",
  inactive_3d_7d: "5. Inactive 3–7 days",
  daily_ai_tools_alert: "6. Daily AI Tools Alert",
  leaderboard_alert: "7. Leaderboard Competition",
  missing_activity: "8. Missing Activity Alert",
  weekly_performance: "9. Weekly Performance Summary",
  trial_end: "10. Trial End Alert",
  premium_upgrade: "11. Premium Upgrade Nudge",
  final_reengagement: "12. Final Re-engagement",
};

async function callVB(action: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("voice-broadcast", {
    body: { action, ...payload },
  });
  if (error) throw new Error(error.message.replace(/^Edge function returned \d+: Error,\s*/i, ""));
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function VoiceBroadcastCenter() {
  const [status, setStatus] = useState<{ hasCreds: boolean; loggedIn: boolean; obdUserId: string | null; error: string | null } | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [busy, setBusy] = useState(false);

  // upload form
  const [upFile, setUpFile] = useState<File | null>(null);
  const [upName, setUpName] = useState("");
  const [upCat, setUpCat] = useState("welcome");

  // TTS form
  const [ttsText, setTtsText] = useState("");
  const [ttsVoiceId, setTtsVoiceId] = useState(TTS_VOICES[0].id);
  const [ttsCampName, setTtsCampName] = useState("");
  const [ttsPhones, setTtsPhones] = useState("");
  const [ttsMode, setTtsMode] = useState<"broadcast" | "save_only">("broadcast");
  const [previewing, setPreviewing] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  const handlePreviewVoice = async () => {
    if (previewAudio) { previewAudio.pause(); setPreviewAudio(null); }
    setPreviewing(true);
    try {
      const sample = ttsText.trim().slice(0, 400) || undefined;
      const r = await callVB("tts_preview", { voiceId: ttsVoiceId, text: sample });
      // Decode base64 → Blob URL (data URIs cause early cutoff with MP3 in some browsers)
      const bin = atob(r.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: r.mime || "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.preload = "auto";
      setPreviewAudio(audio);
      audio.onended = () => { setPreviewAudio(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setPreviewAudio(null); URL.revokeObjectURL(url); };
      await new Promise<void>((resolve) => {
        if (audio.readyState >= 3) resolve();
        else audio.oncanplaythrough = () => resolve();
        setTimeout(resolve, 1500);
      });
      await audio.play();
    } catch (e: any) { toast.error(e.message); } finally { setPreviewing(false); }
  };

  // compose form
  const [phones, setPhones] = useState("");
  const [campName, setCampName] = useState("");
  const [welcomePId, setWelcomePId] = useState("");

  // event automation
  const [eventVoices, setEventVoices] = useState<EventVoice[]>([]);
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [testUserId, setTestUserId] = useState("");
  const [logFilter, setLogFilter] = useState<string>("");

  const refreshStatus = async () => {
    try { setStatus(await callVB("status")); } catch (e: any) { toast.error(e.message); }
  };
  const refreshConfig = async () => {
    const { data } = await supabase.from("voice_broadcast_config").select("*").maybeSingle();
    setConfig(data);
  };
  const refreshVoices = async () => {
    const { data } = await supabase.from("voice_broadcast_voice_files")
      .select("*").order("created_at", { ascending: false });
    setVoices(data || []);
  };
  const refreshCampaigns = async () => {
    try { const r = await callVB("list_campaigns"); setCampaigns(r.campaigns || []); } catch {}
  };
  const syncRemoteVoices = async (silent = false) => {
    if (!silent) setBusy(true);
    try {
      const r = await callVB("list_voices");
      if (!silent) toast.success(`Fetched ${r.prompts?.length || 0} prompts from OBD`);
      // upsert into local cache (mirror OBD truth — approval status, active flag)
      for (const p of r.prompts || []) {
        await supabase.from("voice_broadcast_voice_files").upsert({
          prompt_id: String(p.promptId),
          file_name: p.fileName,
          prompt_category: p.promptCategory,
          prompt_status: p.promptStatus,
          is_active: p.promptStatus === 1,
        }, { onConflict: "prompt_id" });
      }
      await refreshVoices();
    } catch (e: any) { if (!silent) toast.error(e.message); } finally { if (!silent) setBusy(false); }
  };

  const refreshEventVoices = async () => {
    try { const r = await callVB("list_event_voices"); setEventVoices(r.events || []); } catch {}
  };
  const refreshEventLogs = async (key?: string) => {
    try { const r = await callVB("list_event_logs", key ? { event_key: key } : {}); setEventLogs(r.logs || []); } catch {}
  };

  const saveEventVoice = async (ev: EventVoice, patch: Partial<EventVoice>) => {
    try {
      await callVB("save_event_voice", { event_key: ev.event_key, ...patch });
      toast.success("Saved");
      refreshEventVoices();
    } catch (e: any) { toast.error(e.message); }
  };

  const runEventNow = async (key: string) => {
    setBusy(true);
    try {
      const r = await callVB("run_event_now", { event_key: key });
      const result = r.scheduler?.results?.[0];
      if (result) toast.success(`Ran ${key}: ${result.sent || 0} sent, ${result.skipped || 0} skipped`);
      else toast.info(`Ran ${key} (no eligible users)`);
      refreshEventLogs(logFilter || undefined);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const testEventCall = async (key: string) => {
    if (!testUserId.trim()) return toast.error("Enter a user_id (UUID) to test");
    setBusy(true);
    try {
      const r = await callVB("test_event_call", { event_key: key, user_id: testUserId.trim() });
      if (r.ok) toast.success(`Test call scheduled · #${r.campaignId}`);
      else toast.error(r.error || r.response?.message || "Test call failed");
      refreshEventLogs(logFilter || undefined);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  useEffect(() => {
    refreshStatus(); refreshConfig(); refreshCampaigns();
    refreshEventVoices(); refreshEventLogs();
    // Auto-sync voice library from OBD so approval status mirrors remote truth
    syncRemoteVoices(true);
  }, []);

  useEffect(() => { refreshEventLogs(logFilter || undefined); }, [logFilter]);

  const saveConfig = async (patch: Record<string, unknown>) => {
    if (!config?.id) return;
    const { error } = await supabase.from("voice_broadcast_config").update(patch).eq("id", config.id);
    if (error) toast.error(error.message); else { toast.success("Saved"); refreshConfig(); }
  };

  const handleUpload = async () => {
    if (!upFile || !upName) return toast.error("Select file + name");
    setBusy(true);
    try {
      const buf = await upFile.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const fileBase64 = btoa(binary);
      const fileType = upFile.name.toLowerCase().endsWith(".mp3") ? "mp3" : "wav";
      const r = await callVB("upload_voice", { fileBase64, fileName: upName, fileType, promptCategory: upCat });
      toast.success(r.message || "Uploaded");
      setUpFile(null); setUpName("");
      refreshVoices();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const handleCompose = async () => {
    const list = phones.split(/[\s,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!list.length || !campName || !welcomePId) return toast.error("Phones, name, voice required");
    setBusy(true);
    try {
      const b = await callVB("upload_base", { phones: list, baseName: `${campName}-${Date.now()}` });
      const r = await callVB("compose", { campaignName: campName, baseId: b.baseId, welcomePId });
      if (r.pendingApproval) {
        toast.info(r.message || "Voice prompt is pending OBD approval.");
        refreshCampaigns();
        return;
      }
      if (r.obdRejected) {
        toast.error(r.message || "OBD rejected the compose request.");
        refreshCampaigns();
        return;
      }
      toast.success("Campaign scheduled");
      setPhones(""); setCampName("");
      refreshCampaigns();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const autoVoiceName = (txt: string) => {
    const slug = txt.trim().toLowerCase()
      .replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").slice(0, 28).replace(/^-+|-+$/g, "") || "voice";
    const stamp = new Date().toISOString().slice(2,16).replace(/[-:T]/g, "");
    return `${slug}-${stamp}`;
  };

  const handleTTS = async () => {
    if (!ttsText.trim()) return toast.error("Enter message text");
    if (ttsText.length > 400) return toast.error("Keep text under 400 chars (~30 sec voice)");
    const finalName = ttsCampName.trim() || autoVoiceName(ttsText);
    setBusy(true);
    try {
      if (ttsMode === "save_only") {
        const r = await callVB("tts_generate_voice", {
          text: ttsText, voiceName: finalName, voiceId: ttsVoiceId, promptCategory: "welcome",
        });
        toast.success(`Voice saved · Prompt #${r.promptId}`);
        setTtsText(""); setTtsCampName("");
        refreshVoices();
      } else {
        const list = ttsPhones.split(/[\s,;\n]+/).map((s) => s.trim()).filter(Boolean);
        if (!list.length) return toast.error("Add phone numbers");
        const r = await callVB("tts_broadcast", {
          text: ttsText, phones: list, campaignName: finalName, voiceId: ttsVoiceId,
        });
        if (r.pendingApproval) {
          toast.info(r.message || `Voice saved as prompt #${r.promptId}. Schedule after OBD approval.`);
          setTtsText(""); setTtsCampName(""); setTtsPhones("");
          refreshVoices();
          return;
        }
        toast.success(`Scheduled · Campaign #${r.campaignId || "—"}`);
        setTtsText(""); setTtsCampName(""); setTtsPhones("");
        refreshVoices(); refreshCampaigns();
      }
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const controlCampaign = async (action: "pause" | "resume" | "stop", id: string) => {
    try {
      await callVB(action, { campaignId: id });
      toast.success(`Campaign ${action}d`);
      refreshCampaigns();
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteVoice = async (v: Voice) => {
    if (!confirm(`Delete voice "${v.file_name}" (#${v.prompt_id})? This removes it from OBD and the library.`)) return;
    try {
      const r = await callVB("delete_voice", { promptId: v.prompt_id });
      toast.success(r.message || "Voice deleted");
      refreshVoices();
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteCampaign = async (c: Campaign) => {
    if (!confirm(`Delete campaign "${c.campaign_name}"? This stops and removes it from OBD.`)) return;
    try {
      if (c.campaign_id_external) {
        const r = await callVB("delete_campaign", { campaignId: c.campaign_id_external });
        toast.success(r.message || "Campaign deleted");
      } else {
        // Local-only (compose_failed etc.) — just remove the row
        await supabase.from("voice_broadcast_campaigns").delete().eq("id", c.id);
        toast.success("Campaign removed");
      }
      refreshCampaigns();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-primary" /> Voice Broadcast (IVR Calls)
          </h2>
          <p className="text-sm text-muted-foreground">OBD / IVR campaigns powered by ivrsms.com</p>
        </div>
        <div className="flex gap-2 items-center">
          {status && (
            <Badge variant={status.loggedIn ? "default" : "destructive"}>
              {status.loggedIn ? `OBD User #${status.obdUserId}` : status.hasCreds ? "Auth Error" : "No Creds"}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={refreshStatus}><RefreshCcw className="w-4 h-4" /></Button>
        </div>
      </div>

      {status?.error && (
        <Card className="p-3 border-destructive/40 bg-destructive/10 text-sm text-destructive">{status.error}</Card>
      )}

      <Card className="p-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
        <div className="text-xs font-semibold text-muted-foreground mb-1">3-STEP FLOW</div>
        <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
          <span className="px-2 py-1 rounded bg-primary/15">1. Text → Voice</span>
          <span className="text-muted-foreground">→</span>
          <span className="px-2 py-1 rounded bg-primary/15">2. Voice Library</span>
          <span className="text-muted-foreground">→</span>
          <span className="px-2 py-1 rounded bg-primary/15">3. AI Auto-Scheduled Events</span>
        </div>
      </Card>

      <Tabs defaultValue="tts">
        <TabsList>
          <TabsTrigger value="tts">✨ 1. Text → Voice</TabsTrigger>
          <TabsTrigger value="voices">🎙️ 2. Voice Library</TabsTrigger>
          <TabsTrigger value="automation">🤖 3. Event Automation</TabsTrigger>
          <TabsTrigger value="logs">📋 Automation Logs</TabsTrigger>
        </TabsList>

        {/* TTS — generate a voice and save to library (broadcast happens automatically via events) */}
        <TabsContent value="tts">
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Step 1 — Generate Voice from Text</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Type a message in Hinglish, Hindi or English. We generate a natural voice with ElevenLabs and save it to your Voice Library. Then assign it to a lifecycle event in Step 3 — the AI scheduler handles all calls automatically.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Voice Name <span className="text-muted-foreground font-normal">(auto)</span></Label>
                <Input
                  value={ttsCampName}
                  onChange={(e) => setTtsCampName(e.target.value)}
                  placeholder={ttsText.trim() ? autoVoiceName(ttsText) : "auto-generated from your text"}
                />
                <p className="text-xs text-muted-foreground mt-1">Leave blank to auto-name from your text.</p>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Voice</Label>
                  <Button
                    type="button" size="sm" variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={handlePreviewVoice}
                    disabled={previewing}
                  >
                    {previewing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                    {previewAudio ? "Playing…" : "Preview"}
                  </Button>
                </div>
                <Select value={ttsVoiceId} onValueChange={setTtsVoiceId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TTS_VOICES.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Message Text ({ttsText.length}/400 · ~30 sec)</Label>
              <textarea
                className="w-full min-h-[140px] p-2 border rounded bg-background text-sm"
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value.slice(0, 400))}
                placeholder="Namaste! ACRY AI mein aapka swagat hai. Aaj hi apna AI Second Brain activate karein aur smart study shuru karein."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tip: Write Hinglish in Roman script (e.g. "Namaste, aap kaise hain") — multilingual voice handles it naturally.
              </p>
            </div>

            <Button onClick={() => { setTtsMode("save_only"); handleTTS(); }} disabled={busy} className="w-full">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Wand2 className="w-4 h-4 mr-1" />}
              Generate & Save to Voice Library
            </Button>
          </Card>
        </TabsContent>

        {/* VOICE LIBRARY */}
        <TabsContent value="voices">
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Voice Prompts</h3>
              <Button size="sm" variant="outline" onClick={() => syncRemoteVoices()} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sync from OBD"}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border rounded-lg bg-muted/30">
              <div className="md:col-span-2">
                <Label>Wave/MP3 File</Label>
                <Input type="file" accept=".wav,.mp3" onChange={(e) => setUpFile(e.target.files?.[0] || null)} />
              </div>
              <div>
                <Label>File Name</Label>
                <Input value={upName} onChange={(e) => setUpName(e.target.value)} placeholder="welcome-1" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={upCat} onValueChange={setUpCat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["welcome", "menu", "thanks", "noinput", "wronginput"].map((c) =>
                      <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-4">
                <Button onClick={handleUpload} disabled={busy} className="w-full">
                  <Upload className="w-4 h-4 mr-1" /> Upload to OBD
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {voices.length === 0 && <p className="text-sm text-muted-foreground">No prompts yet. Upload or sync.</p>}
              {voices.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground">#{v.prompt_id}</span>
                    <span className="ml-2 font-medium">{v.file_name}</span>
                    <Badge variant="outline" className="ml-2">{v.prompt_category}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={v.is_active ? "default" : "secondary"}>{v.is_active ? "active" : "pending"}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => deleteVoice(v)} title="Delete voice" className="text-destructive hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>


        {/* EVENT AUTOMATION */}
        <TabsContent value="automation">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">AI Voice Automation</h3>
                <p className="text-xs text-muted-foreground">
                  Assign a voice to each lifecycle event. The scheduler runs every 15 minutes and places calls automatically (respecting cooldowns + send window).
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      // Make sure local cache mirrors OBD approvals first
                      await syncRemoteVoices(true);
                      const r = await callVB("auto_assign_events");
                      toast.success(`AI auto-assigned ${r.matched}/${r.total} events with optimal send windows`);
                      refreshEventVoices();
                    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
                  }}
                  disabled={busy}
                  className="bg-gradient-to-r from-primary to-primary/80"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "🤖 Auto-Assign Voices + Best Time (AI)"}
                </Button>
                <Button size="sm" variant="outline" onClick={refreshEventVoices}><RefreshCcw className="w-4 h-4" /></Button>
              </div>

            <div className="flex items-end gap-2 p-2 border rounded bg-muted/30">
              <div className="flex-1">
                <Label className="text-xs">Test user_id (UUID) — used by "Test Call" buttons below</Label>
                <Input value={testUserId} onChange={(e) => setTestUserId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
              </div>
            </div>

            <div className="space-y-2">
              {eventVoices.length === 0 && <p className="text-sm text-muted-foreground">Loading events…</p>}
              {eventVoices.map((ev) => (
                <div key={ev.event_key} className="p-3 border rounded space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-medium text-sm">{EVENT_LABELS[ev.event_key] || ev.event_key}</div>
                      {ev.description && <div className="text-xs text-muted-foreground">{ev.description}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={ev.is_active ? "default" : "secondary"}>{ev.is_active ? "ON" : "OFF"}</Badge>
                      <Switch checked={ev.is_active} onCheckedChange={(v) => saveEventVoice(ev, { is_active: v })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="md:col-span-2">
                      <Label className="text-xs">Voice</Label>
                      <Select value={ev.voice_prompt_id || ""} onValueChange={(v) => saveEventVoice(ev, { voice_prompt_id: v })}>
                        <SelectTrigger><SelectValue placeholder={voices.length ? "Pick a voice from library…" : "No voices uploaded yet"} /></SelectTrigger>
                        <SelectContent>
                          {[...voices]
                            .sort((a, b) => Number(b.prompt_status === 1) - Number(a.prompt_status === 1))
                            .map((v) => {
                              const approved = v.prompt_status === 1;
                              return (
                                <SelectItem key={v.prompt_id} value={v.prompt_id}>
                                  {approved ? "✅" : "⏳"} #{v.prompt_id} · {v.file_name}{approved ? "" : " (pending approval)"}
                                </SelectItem>
                              );
                            })}
                        </SelectContent>
                      </Select>
                      {ev.voice_prompt_id && voices.find(v => v.prompt_id === ev.voice_prompt_id)?.prompt_status !== 1 && (
                        <p className="text-[10px] text-amber-500 mt-1">Voice is pending OBD approval — real calls will be queued until approved.</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Cooldown (hrs)</Label>
                      <Input type="number" defaultValue={ev.cooldown_hours}
                        onBlur={(e) => saveEventVoice(ev, { cooldown_hours: parseInt(e.target.value) || 72 })} />
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <Label className="text-xs">Window start</Label>
                        <Input type="time" defaultValue={ev.send_window_start?.slice(0,5)}
                          onBlur={(e) => saveEventVoice(ev, { send_window_start: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">end</Label>
                        <Input type="time" defaultValue={ev.send_window_end?.slice(0,5)}
                          onBlur={(e) => saveEventVoice(ev, { send_window_end: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => testEventCall(ev.event_key)} disabled={busy || !ev.voice_prompt_id || !testUserId.trim()}>
                      Test Call
                    </Button>
                    <Button size="sm" onClick={() => runEventNow(ev.event_key)} disabled={busy || !ev.is_active || !ev.voice_prompt_id}>
                      Run Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* AUTOMATION LOGS */}
        <TabsContent value="logs">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold">Automation Logs</h3>
              <div className="flex items-center gap-2">
                <Select value={logFilter || "__all__"} onValueChange={(v) => setLogFilter(v === "__all__" ? "" : v)}>
                  <SelectTrigger className="w-[240px]"><SelectValue placeholder="All events" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All events</SelectItem>
                    {Object.entries(EVENT_LABELS).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => refreshEventLogs(logFilter || undefined)}>
                  <RefreshCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {eventLogs.length === 0 && <p className="text-sm text-muted-foreground">No automation calls yet.</p>}
            <div className="space-y-1">
              {eventLogs.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-2 border rounded text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline">{EVENT_LABELS[l.event_key]?.split(". ")[1] || l.event_key}</Badge>
                    <span className="font-mono text-muted-foreground truncate max-w-[160px]">{l.user_id?.slice(0,8)}…</span>
                    {l.campaign_id_external && <span className="font-mono text-muted-foreground">#{l.campaign_id_external}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={l.status === "queued" ? "default" : l.status === "failed" ? "destructive" : "secondary"}>
                      {l.status}
                    </Badge>
                    <span className="text-muted-foreground">{new Date(l.sent_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
