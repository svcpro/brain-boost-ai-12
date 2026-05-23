import { useState } from "react";
import { motion } from "framer-motion";
import { AmbCard, AMB, NeonButton, HudCorners, getLevel } from "./ui/primitives";
import type { AmbassadorProfile } from "./useAmbassador";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Camera, Save, Eye, Link2, Instagram, Linkedin, Twitter, Youtube, Globe,
  MapPin, GraduationCap, Sparkles, Trophy, Flame, Zap, Share2, BadgeCheck, Heart,
} from "lucide-react";

type ExtendedProfile = AmbassadorProfile & {
  interests?: string[] | null;
  headline?: string | null;
};

export function ProfileSection({
  profile,
  onUpdated,
}: {
  profile: AmbassadorProfile;
  onUpdated: () => void;
}) {
  const ext = profile as ExtendedProfile;
  const [form, setForm] = useState({
    full_name: profile.full_name || "",
    headline: ext.headline || "",
    bio: profile.bio || "",
    college: profile.college || "",
    city: profile.city || "",
    course: profile.course || "",
    skills: (profile.skills || []).join(", "),
    interests: (ext.interests || []).join(", "),
    instagram: profile.instagram || "",
    linkedin: profile.linkedin || "",
    twitter: profile.twitter || "",
    youtube: profile.youtube || "",
    website: profile.website || "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const toList = (s: string, max = 12) =>
    s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, max);

  const onSave = async () => {
    if (form.full_name.trim().length < 2) {
      toast.error("Name is too short");
      return;
    }
    if (form.bio.length > 600) {
      toast.error("Bio must be under 600 characters");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      skills: toList(form.skills, 12),
      interests: toList(form.interests, 12),
    };
    const { error } = await supabase
      .from("ambassador_profiles" as any)
      .update(payload)
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
    const ext2 = file.name.split(".").pop() || "png";
    const path = `ambassadors/${profile.user_id}-${Date.now()}.${ext2}`;
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

  const sharePublic = async () => {
    if (!publicUrl) return;
    try {
      if (navigator.share) await navigator.share({ title: form.full_name, url: publicUrl });
      else {
        await navigator.clipboard.writeText(publicUrl);
        toast.success("Public profile link copied");
      }
    } catch {}
  };

  const previewProfile: ExtendedProfile = {
    ...profile,
    full_name: form.full_name,
    bio: form.bio,
    college: form.college,
    city: form.city,
    course: form.course,
    skills: toList(form.skills, 12),
    interests: toList(form.interests, 12),
    instagram: form.instagram,
    linkedin: form.linkedin,
    twitter: form.twitter,
    youtube: form.youtube,
    website: form.website,
    headline: form.headline,
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
      {/* ===== Edit panel ===== */}
      <AmbCard className="p-5 sm:p-6" hud glow={AMB.purple}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: AMB.cyan }}>
              Ambassador Identity
            </div>
            <div className="text-base font-bold" style={{ color: AMB.text, fontFamily: "'Space Grotesk', sans-serif" }}>
              Edit profile
            </div>
          </div>
          <NeonButton variant="ghost" onClick={sharePublic}>
            <Share2 className="h-4 w-4" />
            Share
          </NeonButton>
        </div>

        {/* Avatar */}
        <div className="mb-5 flex items-center gap-4">
          <label className="relative cursor-pointer">
            <motion.div
              className="absolute -inset-1 rounded-2xl opacity-70"
              style={{ background: `conic-gradient(from 0deg, ${AMB.cyan}, ${AMB.amber}, ${AMB.purple}, ${AMB.cyan})`, filter: "blur(5px)" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            />
            <div
              className="relative grid h-20 w-20 place-items-center overflow-hidden rounded-2xl text-xl font-bold"
              style={{
                background: `linear-gradient(135deg, ${AMB.cyan}, ${AMB.amber})`,
                color: "#1a0726",
                boxShadow: `0 8px 22px -8px ${AMB.cyan}`,
              }}
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} className="h-full w-full object-cover" alt="" />
              ) : (
                (form.full_name || "A").slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2" style={{ background: AMB.cyan, borderColor: AMB.bg }}>
              <Camera className="h-3.5 w-3.5" style={{ color: "#1a0726" }} />
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onAvatarChange(e.target.files[0])}
            />
          </label>
          <div className="flex-1 text-xs" style={{ color: AMB.mute }}>
            {uploading ? "Uploading…" : "Tap your avatar to upload a new photo (max 4MB, square works best)."}
            <div className="mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]"
                 style={{ borderColor: `${AMB.amber}55`, color: AMB.amber, background: `${AMB.amber}10` }}>
              {profile.ambassador_code || "AMB"}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
          <Field label="Headline" value={form.headline} onChange={(v) => setForm({ ...form, headline: v })} placeholder="Campus Lead · AI · ACRY" />
          <Field label="College" value={form.college} onChange={(v) => setForm({ ...form, college: v })} icon={<GraduationCap className="h-3.5 w-3.5" />} />
          <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} icon={<MapPin className="h-3.5 w-3.5" />} />
          <Field label="Course / Year" value={form.course} onChange={(v) => setForm({ ...form, course: v })} className="sm:col-span-2" />
          <Field label="Bio" value={form.bio} onChange={(v) => setForm({ ...form, bio: v })} className="sm:col-span-2" textarea placeholder="A short story about you, your campus, and why you're building the AI movement…" />
          <Field
            label="Skills (comma separated)"
            value={form.skills}
            onChange={(v) => setForm({ ...form, skills: v })}
            className="sm:col-span-2"
            placeholder="AI, Public Speaking, Content Creation…"
            icon={<Sparkles className="h-3.5 w-3.5" />}
          />
          <Field
            label="Interests (comma separated)"
            value={form.interests}
            onChange={(v) => setForm({ ...form, interests: v })}
            className="sm:col-span-2"
            placeholder="Robotics, Startups, UPSC, Cricket…"
            icon={<Heart className="h-3.5 w-3.5" />}
          />
          <Field label="LinkedIn" value={form.linkedin} onChange={(v) => setForm({ ...form, linkedin: v })} icon={<Linkedin className="h-3.5 w-3.5" />} placeholder="https://linkedin.com/in/…" />
          <Field label="Instagram" value={form.instagram} onChange={(v) => setForm({ ...form, instagram: v })} icon={<Instagram className="h-3.5 w-3.5" />} placeholder="https://instagram.com/…" />
          <Field label="Twitter / X" value={form.twitter} onChange={(v) => setForm({ ...form, twitter: v })} icon={<Twitter className="h-3.5 w-3.5" />} />
          <Field label="YouTube" value={form.youtube} onChange={(v) => setForm({ ...form, youtube: v })} icon={<Youtube className="h-3.5 w-3.5" />} />
          <Field label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} icon={<Globe className="h-3.5 w-3.5" />} className="sm:col-span-2" />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex max-w-full items-center gap-2 truncate text-xs"
            style={{ color: AMB.cyan }}
            onClick={() => {
              if (!publicUrl) return;
              navigator.clipboard.writeText(publicUrl);
              toast.success("Public profile link copied");
            }}
          >
            <Link2 className="h-3.5 w-3.5" />
            <span className="truncate">{publicUrl || "—"}</span>
          </button>
          <NeonButton onClick={onSave} disabled={saving} variant="primary">
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save changes"}
          </NeonButton>
        </div>
      </AmbCard>

      {/* ===== LinkedIn-style live preview ===== */}
      <div className="lg:sticky lg:top-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: AMB.mute }}>
            <Eye className="mr-1 inline h-3 w-3" /> Live public preview
          </div>
          <div className="text-[10px]" style={{ color: AMB.mute }}>
            Updates as you type
          </div>
        </div>
        <PublicProfileCard profile={previewProfile} />
      </div>
    </div>
  );
}

/* ───────────────────── LinkedIn-style public card ───────────────────── */

export function PublicProfileCard({ profile }: { profile: ExtendedProfile }) {
  const level = getLevel(profile.xp);
  const initials = (profile.full_name || "A").slice(0, 2).toUpperCase();
  const socials: Array<{ key: string; href: string; icon: React.ReactNode; label: string; color: string }> = [];
  if (profile.linkedin) socials.push({ key: "li", href: profile.linkedin, icon: <Linkedin className="h-3.5 w-3.5" />, label: "LinkedIn", color: "#0a66c2" });
  if (profile.instagram) socials.push({ key: "ig", href: profile.instagram, icon: <Instagram className="h-3.5 w-3.5" />, label: "Instagram", color: "#e1306c" });
  if (profile.twitter) socials.push({ key: "tw", href: profile.twitter, icon: <Twitter className="h-3.5 w-3.5" />, label: "X", color: "#1da1f2" });
  if (profile.youtube) socials.push({ key: "yt", href: profile.youtube, icon: <Youtube className="h-3.5 w-3.5" />, label: "YouTube", color: "#ff0033" });
  if (profile.website) socials.push({ key: "ws", href: profile.website, icon: <Globe className="h-3.5 w-3.5" />, label: "Website", color: AMB.cyan });

  return (
    <AmbCard className="overflow-hidden p-0" hud glow={AMB.cyan}>
      {/* Cover banner */}
      <div
        className="relative h-28"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, ${AMB.cyan}55 0%, transparent 55%),
            radial-gradient(circle at 80% 60%, ${AMB.amber}44 0%, transparent 60%),
            radial-gradient(circle at 50% 100%, ${AMB.purple}55 0%, transparent 70%),
            linear-gradient(135deg, #1a0726, #0d0512)
          `,
        }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,244,234,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,244,234,0.06) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <HudCorners color={AMB.amber} size={12} />
        <span
          className="absolute right-3 top-3 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em]"
          style={{ borderColor: `${AMB.amber}66`, color: AMB.amber, background: "rgba(13,5,18,0.6)", backdropFilter: "blur(8px)" }}
        >
          {profile.ambassador_code || "AMB"}
        </span>
      </div>

      <div className="relative px-5 pb-5">
        {/* Avatar overlapping cover */}
        <div className="-mt-10 flex items-end justify-between">
          <div className="relative">
            <motion.div
              className="absolute -inset-1 rounded-2xl opacity-70"
              style={{ background: `conic-gradient(from 0deg, ${AMB.cyan}, ${AMB.amber}, ${AMB.purple}, ${AMB.cyan})`, filter: "blur(6px)" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            />
            <div
              className="relative grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border-4 text-xl font-bold"
              style={{
                background: `linear-gradient(135deg, ${AMB.cyan}, ${AMB.amber})`,
                color: "#1a0726",
                borderColor: AMB.bg,
              }}
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} className="h-full w-full object-cover" alt={profile.full_name} />
              ) : (
                initials
              )}
            </div>
          </div>
          <span
            className="mb-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
            style={{ background: `${level.current.color}22`, color: level.current.color, border: `1px solid ${level.current.color}55` }}
          >
            <span>{level.current.icon}</span> {level.current.name}
          </span>
        </div>

        {/* Name & headline */}
        <div className="mt-3">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xl font-bold" style={{ color: AMB.text, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.01em" }}>
              {profile.full_name || "Ambassador"}
            </h3>
            <BadgeCheck className="h-4 w-4" style={{ color: AMB.cyan }} />
          </div>
          {profile.headline && (
            <div className="mt-0.5 text-sm" style={{ color: AMB.text }}>
              {profile.headline}
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]" style={{ color: AMB.mute }}>
            {profile.college && (
              <span className="inline-flex items-center gap-1">
                <GraduationCap className="h-3 w-3" /> {profile.college}
              </span>
            )}
            {profile.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {profile.city}
              </span>
            )}
            {profile.course && <span>· {profile.course}</span>}
          </div>
        </div>

        {/* Stat strip */}
        <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border" style={{ borderColor: AMB.border, background: "rgba(255,244,234,0.03)" }}>
          <StatCell icon={<Zap className="h-3 w-3" />} label="XP" value={profile.xp.toLocaleString()} color={AMB.cyan} />
          <StatCell icon={<Trophy className="h-3 w-3" />} label="Rank" value={profile.rank ? `#${profile.rank}` : "—"} color={AMB.amber} divider />
          <StatCell icon={<Flame className="h-3 w-3" />} label="Streak" value={`${profile.streak_days}d`} color={AMB.pink} divider />
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="mt-4">
            <SectionLabel>About</SectionLabel>
            <p className="mt-1 whitespace-pre-line text-xs leading-relaxed" style={{ color: AMB.text }}>
              {profile.bio}
            </p>
          </div>
        )}

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <div className="mt-4">
            <SectionLabel>Skills</SectionLabel>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {profile.skills.slice(0, 12).map((s) => (
                <span
                  key={s}
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={{ background: `${AMB.cyan}14`, color: AMB.text, border: `1px solid ${AMB.cyan}40` }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Interests */}
        {profile.interests && profile.interests.length > 0 && (
          <div className="mt-4">
            <SectionLabel>Interests</SectionLabel>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {profile.interests.slice(0, 12).map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={{ background: `${AMB.purple}14`, color: AMB.text, border: `1px solid ${AMB.purple}40` }}
                >
                  <Heart className="h-2.5 w-2.5" style={{ color: AMB.pink }} /> {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Social buttons */}
        {socials.length > 0 && (
          <div className="mt-4">
            <SectionLabel>Connect</SectionLabel>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {socials.map((s) => (
                <a
                  key={s.key}
                  href={s.href.startsWith("http") ? s.href : `https://${s.href}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition hover:scale-[1.03]"
                  style={{ borderColor: `${s.color}55`, color: AMB.text, background: `${s.color}14` }}
                >
                  <span style={{ color: s.color }}>{s.icon}</span> {s.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </AmbCard>
  );
}

/* ───────────────────── small bits ───────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: AMB.cyan }}>
      {children}
    </div>
  );
}

function StatCell({ icon, label, value, color, divider }: { icon: React.ReactNode; label: string; value: string; color: string; divider?: boolean }) {
  return (
    <div
      className="px-3 py-2 text-center"
      style={{ borderLeft: divider ? `1px solid ${AMB.border}` : undefined }}
    >
      <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-[0.18em]" style={{ color: AMB.mute }}>
        <span style={{ color }}>{icon}</span> {label}
      </div>
      <div className="mt-0.5 text-sm font-bold" style={{ color: AMB.text, fontFamily: "'Space Grotesk', sans-serif" }}>
        {value}
      </div>
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
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em]" style={{ color: AMB.mute }}>
        {icon}
        {label}
      </div>
      <Comp
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={textarea ? 3 : undefined}
        maxLength={textarea ? 600 : 200}
        className="w-full rounded-lg border bg-white/5 px-3 py-2 text-sm outline-none transition focus:border-cyan-400/60"
        style={{ borderColor: AMB.border, color: AMB.text }}
      />
    </label>
  );
}
