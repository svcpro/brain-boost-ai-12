import { useState } from "react";
import { motion } from "framer-motion";
import { AmbCard, AMB, NeonButton } from "./ui/primitives";
import type { AmbassadorProfile } from "./useAmbassador";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, Save, Eye, Link2, Instagram, Linkedin, Twitter, Youtube, Globe } from "lucide-react";

export function ProfileSection({
  profile,
  onUpdated,
}: {
  profile: AmbassadorProfile;
  onUpdated: () => void;
}) {
  const [form, setForm] = useState({
    full_name: profile.full_name || "",
    bio: profile.bio || "",
    college: profile.college || "",
    city: profile.city || "",
    course: profile.course || "",
    skills: (profile.skills || []).join(", "),
    instagram: profile.instagram || "",
    linkedin: profile.linkedin || "",
    twitter: profile.twitter || "",
    youtube: profile.youtube || "",
    website: profile.website || "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const onSave = async () => {
    setSaving(true);
    const skills = form.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
    const { error } = await supabase
      .from("ambassador_profiles" as any)
      .update({ ...form, skills })
      .eq("user_id", profile.user_id);
    setSaving(false);
    if (error) {
      toast.error("Failed to save profile");
      return;
    }
    toast.success("Profile updated");
    onUpdated();
  };

  const onAvatarChange = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Image must be under 4MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `ambassadors/${profile.user_id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      toast.error("Upload failed");
      return;
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase
      .from("ambassador_profiles" as any)
      .update({ avatar_url: pub.publicUrl })
      .eq("user_id", profile.user_id);
    setUploading(false);
    toast.success("Photo updated");
    onUpdated();
  };

  const publicUrl = profile.public_slug
    ? `${window.location.origin}/ambassador/p/${profile.public_slug}`
    : "";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <AmbCard className="p-5 lg:col-span-2">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider" style={{ color: AMB.mute }}>
              Edit profile
            </div>
            <div className="text-base font-semibold" style={{ color: AMB.text }}>
              Your Ambassador Identity
            </div>
          </div>
          <NeonButton variant="ghost" onClick={() => setShowPreview((v) => !v)}>
            <Eye className="h-4 w-4" />
            {showPreview ? "Hide" : "Public view"}
          </NeonButton>
        </div>

        <div className="mb-5 flex items-center gap-4">
          <label className="relative cursor-pointer">
            <div
              className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl text-xl font-bold"
              style={{
                background: `linear-gradient(135deg, ${AMB.purple}, ${AMB.cyan})`,
                color: "#fff",
              }}
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} className="h-full w-full object-cover" alt="" />
              ) : (
                (profile.full_name || "A").slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full" style={{ background: AMB.purple }}>
              <Camera className="h-3.5 w-3.5 text-white" />
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onAvatarChange(e.target.files[0])}
            />
          </label>
          <div className="flex-1 text-xs" style={{ color: AMB.mute }}>
            {uploading ? "Uploading…" : "Tap your avatar to upload a new photo (max 4MB)."}
            <div className="mt-1" style={{ color: AMB.cyan }}>
              {profile.ambassador_code}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <Field label="College" value={form.college} onChange={(v) => setForm({ ...form, college: v })} />
          <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          <Field label="Course / Year" value={form.course} onChange={(v) => setForm({ ...form, course: v })} />
          <Field label="Bio" value={form.bio} onChange={(v) => setForm({ ...form, bio: v })} className="sm:col-span-2" textarea />
          <Field
            label="Skills (comma separated)"
            value={form.skills}
            onChange={(v) => setForm({ ...form, skills: v })}
            className="sm:col-span-2"
            placeholder="AI, Public Speaking, Content Creation…"
          />
          <Field label="Instagram" value={form.instagram} onChange={(v) => setForm({ ...form, instagram: v })} icon={<Instagram className="h-3.5 w-3.5" />} />
          <Field label="LinkedIn" value={form.linkedin} onChange={(v) => setForm({ ...form, linkedin: v })} icon={<Linkedin className="h-3.5 w-3.5" />} />
          <Field label="Twitter / X" value={form.twitter} onChange={(v) => setForm({ ...form, twitter: v })} icon={<Twitter className="h-3.5 w-3.5" />} />
          <Field label="YouTube" value={form.youtube} onChange={(v) => setForm({ ...form, youtube: v })} icon={<Youtube className="h-3.5 w-3.5" />} />
          <Field label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} icon={<Globe className="h-3.5 w-3.5" />} className="sm:col-span-2" />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            className="inline-flex items-center gap-2 text-xs"
            style={{ color: AMB.cyan }}
            onClick={() => {
              if (!publicUrl) return;
              navigator.clipboard.writeText(publicUrl);
              toast.success("Public profile link copied");
            }}
          >
            <Link2 className="h-3.5 w-3.5" />
            {publicUrl || "—"}
          </button>
          <NeonButton onClick={onSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save changes"}
          </NeonButton>
        </div>
      </AmbCard>

      {/* Public preview card */}
      <AmbCard className="p-5" glow={AMB.cyan}>
        <div className="mb-3 text-xs uppercase tracking-wider" style={{ color: AMB.mute }}>
          Public profile preview
        </div>
        <motion.div
          key={showPreview ? "open" : "closed"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-4"
          style={{ borderColor: AMB.border, background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl text-sm font-bold"
              style={{ background: `linear-gradient(135deg, ${AMB.purple}, ${AMB.cyan})`, color: "#fff" }}
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} className="h-full w-full object-cover" alt="" />
              ) : (
                (form.full_name || "A").slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: AMB.text }}>
                {form.full_name || "Ambassador"}
              </div>
              <div className="text-[11px]" style={{ color: AMB.mute }}>
                {form.college || "College"} • {form.city || "City"}
              </div>
            </div>
          </div>
          {form.bio && (
            <div className="mt-3 text-xs leading-relaxed" style={{ color: AMB.text }}>
              {form.bio}
            </div>
          )}
          {form.skills && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {form.skills
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 8)
                .map((s) => (
                  <span
                    key={s}
                    className="rounded-full px-2 py-0.5 text-[10px]"
                    style={{ background: `${AMB.purple}20`, color: AMB.text, border: `1px solid ${AMB.purple}40` }}
                  >
                    {s}
                  </span>
                ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {form.linkedin && <SocialChip icon={<Linkedin className="h-3 w-3" />} label="LinkedIn" />}
            {form.instagram && <SocialChip icon={<Instagram className="h-3 w-3" />} label="Instagram" />}
            {form.twitter && <SocialChip icon={<Twitter className="h-3 w-3" />} label="X" />}
            {form.youtube && <SocialChip icon={<Youtube className="h-3 w-3" />} label="YouTube" />}
            {form.website && <SocialChip icon={<Globe className="h-3 w-3" />} label="Site" />}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg px-3 py-2" style={{ background: `${AMB.cyan}10`, border: `1px solid ${AMB.cyan}30` }}>
            <span className="text-[11px]" style={{ color: AMB.mute }}>
              {profile.ai_level}
            </span>
            <span className="text-sm font-bold" style={{ color: AMB.cyan }}>
              {profile.xp.toLocaleString()} XP
            </span>
          </div>
        </motion.div>
      </AmbCard>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
  textarea,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  textarea?: boolean;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  const Comp: any = textarea ? "textarea" : "input";
  return (
    <label className={className}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider" style={{ color: AMB.mute }}>
        {icon}
        {label}
      </div>
      <Comp
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={textarea ? 3 : undefined}
        className="w-full rounded-lg border bg-white/5 px-3 py-2 text-sm outline-none transition focus:border-cyan-400/50"
        style={{ borderColor: AMB.border, color: AMB.text }}
      />
    </label>
  );
}

function SocialChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
      style={{ background: "rgba(255,255,255,0.04)", color: AMB.text, border: `1px solid ${AMB.border}` }}
    >
      {icon}
      {label}
    </span>
  );
}
