import { useState } from "react";
import { Btn, Card, T } from "./ui";
import type { AmbassadorProfile } from "../useAmbassador";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Save, Instagram, Linkedin, Globe } from "lucide-react";
import { toast } from "sonner";

export function SimpleProfile({
  profile,
  onUpdated,
}: {
  profile: AmbassadorProfile;
  onUpdated: () => void;
}) {
  const [form, setForm] = useState({
    full_name: profile.full_name || "",
    college: profile.college || "",
    city: profile.city || "",
    bio: profile.bio || "",
    instagram: profile.instagram || "",
    linkedin: profile.linkedin || "",
    website: profile.website || "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const initials = (profile.full_name || profile.email).slice(0, 2).toUpperCase();

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("ambassador_profiles" as any)
      .update(form as any)
      .eq("user_id", profile.user_id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    onUpdated();
  };

  const uploadAvatar = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${profile.user_id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      setUploading(false);
      return toast.error(error.message);
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("ambassador_profiles" as any).update({ avatar_url: pub.publicUrl } as any).eq("user_id", profile.user_id);
    setUploading(false);
    toast.success("Photo updated");
    onUpdated();
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <label className="relative cursor-pointer">
            <div
              className="grid h-20 w-20 place-items-center rounded-2xl text-2xl font-bold overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${T.purple}, ${T.cyan})`, color: "#0a0a0a" }}
            >
              {profile.avatar_url ? <img src={profile.avatar_url} className="h-full w-full object-cover" alt="" /> : initials}
            </div>
            <div
              className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full"
              style={{ background: T.purple, color: "#fff" }}
            >
              <Camera className="h-3.5 w-3.5" />
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            />
          </label>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold" style={{ color: T.text }}>
              {profile.full_name || "Ambassador"}
            </div>
            <div className="truncate text-[11px]" style={{ color: T.mute }}>
              {profile.email}
            </div>
            <div className="mt-1 text-[11px]" style={{ color: T.cyan }}>
              {profile.ambassador_code || "ACRY-XXXXXX"}
            </div>
          </div>
        </div>
        {uploading && <div className="mt-2 text-[11px]" style={{ color: T.mute }}>Uploading…</div>}
      </Card>

      <Card>
        <div className="space-y-3">
          <Field label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="College" value={form.college} onChange={(v) => setForm({ ...form, college: v })} />
            <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          </div>
          <Field label="Bio" value={form.bio} onChange={(v) => setForm({ ...form, bio: v })} textarea />
          <Field
            label="Instagram"
            value={form.instagram}
            onChange={(v) => setForm({ ...form, instagram: v })}
            icon={<Instagram className="h-4 w-4" />}
            placeholder="@yourhandle"
          />
          <Field
            label="LinkedIn"
            value={form.linkedin}
            onChange={(v) => setForm({ ...form, linkedin: v })}
            icon={<Linkedin className="h-4 w-4" />}
            placeholder="linkedin.com/in/you"
          />
          <Field
            label="Website"
            value={form.website}
            onChange={(v) => setForm({ ...form, website: v })}
            icon={<Globe className="h-4 w-4" />}
          />
        </div>
        <Btn variant="primary" className="mt-4 w-full" onClick={save} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
        </Btn>
      </Card>

      <Btn
        variant="ghost"
        className="w-full"
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.reload();
        }}
      >
        Sign out
      </Btn>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea,
  icon,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  icon?: React.ReactNode;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider" style={{ color: T.mute }}>
        {icon}
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full resize-none rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-purple-500"
          style={{ borderColor: T.border, color: T.text }}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-purple-500"
          style={{ borderColor: T.border, color: T.text }}
        />
      )}
    </label>
  );
}
