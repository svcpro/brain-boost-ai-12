import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Palette, Image, Mail, Globe, Loader2, Save, Upload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Branding {
  id?: string;
  institution_id: string;
  logo_url: string;
  logo_dark_url: string;
  favicon_url: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  custom_css: string;
  email_sender_name: string;
  email_sender_address: string;
  email_reply_to: string;
  email_logo_url: string;
  app_title: string;
  tagline: string;
  support_email: string;
  support_url: string;
  privacy_url: string;
  terms_url: string;
}

const DEFAULTS: Omit<Branding, "institution_id"> = {
  logo_url: "", logo_dark_url: "", favicon_url: "",
  primary_color: "#6366f1", secondary_color: "#8b5cf6", accent_color: "#f59e0b",
  font_family: "Inter", custom_css: "",
  email_sender_name: "", email_sender_address: "", email_reply_to: "", email_logo_url: "",
  app_title: "", tagline: "", support_email: "", support_url: "", privacy_url: "", terms_url: "",
};

interface Props {
  institutionId: string;
  institutionName: string;
}

export default function BrandingConfig({ institutionId, institutionName }: Props) {
  const { toast } = useToast();
  const [branding, setBranding] = useState<Branding>({ institution_id: institutionId, ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadBranding(); }, [institutionId]);

  const loadBranding = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("whitelabel_branding")
      .select("*")
      .eq("institution_id", institutionId)
      .maybeSingle();
    if (data) setBranding(data as any);
    else setBranding({ institution_id: institutionId, ...DEFAULTS });
    setLoading(false);
  };

  const saveBranding = async () => {
    setSaving(true);
    const payload = { ...branding, institution_id: institutionId };
    delete (payload as any).id;

    if (branding.id) {
      const { error } = await supabase.from("whitelabel_branding").update(payload).eq("id", branding.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Branding saved ✅" });
    } else {
      const { error } = await supabase.from("whitelabel_branding").insert(payload);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else { toast({ title: "Branding created ✅" }); loadBranding(); }
    }
    setSaving(false);
  };

  const uploadLogo = async (file: File, field: "logo_url" | "logo_dark_url" | "favicon_url" | "email_logo_url") => {
    const ext = file.name.split(".").pop();
    const path = `${institutionId}/${field}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast({ title: "Upload failed", variant: "destructive" }); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    setBranding(prev => ({ ...prev, [field]: publicUrl }));
    toast({ title: "Uploaded ✅" });
  };

  const update = (key: keyof Branding, value: string) => setBranding(prev => ({ ...prev, [key]: value }));

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center">
            <Palette className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Brand Customization</h3>
            <p className="text-[10px] text-muted-foreground">{institutionName}</p>
          </div>
        </div>
        <button onClick={saveBranding} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </button>
      </div>

      {/* Live Preview */}
      <div className="glass rounded-xl p-4 neural-border" style={{ borderColor: branding.primary_color + "40" }}>
        <p className="text-[10px] text-muted-foreground mb-2">Live Preview</p>
        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: branding.primary_color + "10" }}>
          {branding.logo_url ? (
            <img src={branding.logo_url} alt="Logo" className="w-10 h-10 rounded-lg object-contain" />
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: branding.primary_color + "30" }}>
              <span className="text-sm font-bold" style={{ color: branding.primary_color }}>{institutionName[0]}</span>
            </div>
          )}
          <div>
            <span className="text-sm font-bold" style={{ color: branding.primary_color, fontFamily: branding.font_family }}>
              {branding.app_title || institutionName}
            </span>
            <p className="text-[10px]" style={{ color: branding.secondary_color }}>{branding.tagline || "Powered by ACRY"}</p>
          </div>
        </div>
      </div>

      {/* Visual Identity */}
      <div className="glass rounded-xl p-4 neural-border space-y-4">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><Image className="w-4 h-4 text-primary" /> Visual Identity</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Logos */}
          {(["logo_url", "logo_dark_url", "favicon_url"] as const).map(field => (
            <div key={field} className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground capitalize">{field.replace(/_/g, " ")}</label>
              <div className="flex items-center gap-2">
                {branding[field] && <img src={branding[field]} className="w-8 h-8 rounded object-contain bg-secondary" />}
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 text-xs text-muted-foreground hover:text-foreground cursor-pointer border border-border/50">
                  <Upload className="w-3 h-3" /> Upload
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0], field)} />
                </label>
                <input value={branding[field]} onChange={e => update(field, e.target.value)} placeholder="or paste URL" className="flex-1 bg-secondary/60 border border-border/50 rounded-lg px-2 py-1.5 text-[10px] text-foreground" />
              </div>
            </div>
          ))}
        </div>

        {/* Colors */}
        <div className="grid grid-cols-3 gap-3">
          {(["primary_color", "secondary_color", "accent_color"] as const).map(field => (
            <div key={field} className="space-y-1">
              <label className="text-[10px] text-muted-foreground capitalize">{field.replace(/_/g, " ")}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={branding[field]} onChange={e => update(field, e.target.value)} className="w-8 h-8 rounded border-0 cursor-pointer" />
                <input value={branding[field]} onChange={e => update(field, e.target.value)} className="flex-1 bg-secondary/60 border border-border/50 rounded-lg px-2 py-1.5 text-xs font-mono text-foreground" />
              </div>
            </div>
          ))}
        </div>

        {/* Font & App Info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground">Font Family</label>
            <select value={branding.font_family} onChange={e => update("font_family", e.target.value)} className="w-full bg-secondary/60 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground mt-1">
              {["Inter", "Poppins", "Roboto", "Montserrat", "Open Sans", "Lato", "Nunito"].map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">App Title</label>
            <input value={branding.app_title} onChange={e => update("app_title", e.target.value)} className="w-full bg-secondary/60 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground mt-1" />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground">Tagline</label>
          <input value={branding.tagline} onChange={e => update("tagline", e.target.value)} className="w-full bg-secondary/60 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground mt-1" />
        </div>
      </div>

      {/* Email Configuration */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Email Sender Config</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(["email_sender_name", "email_sender_address", "email_reply_to"] as const).map(field => (
            <div key={field}>
              <label className="text-[10px] text-muted-foreground capitalize">{field.replace(/email_/g, "").replace(/_/g, " ")}</label>
              <input value={branding[field]} onChange={e => update(field, e.target.value)} className="w-full bg-secondary/60 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground mt-1" />
            </div>
          ))}
          <div>
            <label className="text-[10px] text-muted-foreground">Email Logo</label>
            <div className="flex items-center gap-2 mt-1">
              <label className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-secondary/60 text-[10px] cursor-pointer border border-border/50">
                <Upload className="w-3 h-3" /> Upload
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0], "email_logo_url")} />
              </label>
              <input value={branding.email_logo_url} onChange={e => update("email_logo_url", e.target.value)} placeholder="URL" className="flex-1 bg-secondary/60 border border-border/50 rounded-lg px-2 py-1.5 text-[10px] text-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><Globe className="w-4 h-4 text-primary" /> Links & Support</h4>
        <div className="grid grid-cols-2 gap-3">
          {(["support_email", "support_url", "privacy_url", "terms_url"] as const).map(field => (
            <div key={field}>
              <label className="text-[10px] text-muted-foreground capitalize">{field.replace(/_/g, " ")}</label>
              <input value={branding[field]} onChange={e => update(field, e.target.value)} className="w-full bg-secondary/60 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground mt-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
