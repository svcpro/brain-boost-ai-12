import { useState, useEffect } from "react";
import {
  Globe, Loader2, Plus, CheckCircle2, Clock, AlertTriangle, Shield, Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Domain {
  id: string;
  institution_id: string;
  domain: string;
  subdomain: string | null;
  domain_type: string;
  verification_token: string | null;
  verification_status: string;
  verified_at: string | null;
  ssl_status: string;
  is_primary: boolean;
}

interface Props {
  institutionId: string;
  institutionName: string;
}

export default function DomainManagement({ institutionId, institutionName }: Props) {
  const { toast } = useToast();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => { loadDomains(); }, [institutionId]);

  const loadDomains = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("whitelabel_domains")
      .select("*")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false });
    setDomains((data as any[]) || []);
    setLoading(false);
  };

  const addDomain = async () => {
    if (!newDomain.trim()) return;
    setAdding(true);
    const token = `lovable_verify_${crypto.randomUUID().slice(0, 12)}`;

    const { error } = await supabase.from("whitelabel_domains").insert({
      institution_id: institutionId,
      domain: newDomain.trim().toLowerCase(),
      verification_token: token,
      verification_status: "pending",
    });

    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Domain added — verify DNS" }); setNewDomain(""); setShowAdd(false); loadDomains(); }
    setAdding(false);
  };

  const setPrimary = async (domainId: string) => {
    await supabase.from("whitelabel_domains").update({ is_primary: false }).eq("institution_id", institutionId);
    await supabase.from("whitelabel_domains").update({ is_primary: true }).eq("id", domainId);
    loadDomains();
    toast({ title: "Primary domain set ✅" });
  };

  const deleteDomain = async (domainId: string) => {
    if (!confirm("Remove this domain?")) return;
    await supabase.from("whitelabel_domains").delete().eq("id", domainId);
    loadDomains();
  };

  const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
    verified: { icon: CheckCircle2, color: "text-success", label: "Verified" },
    pending: { icon: Clock, color: "text-warning", label: "Pending Verification" },
    failed: { icon: AlertTriangle, color: "text-destructive", label: "Failed" },
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Domain Mapping</h3>
            <p className="text-[10px] text-muted-foreground">{institutionName} • Custom domain verification</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
          <Plus className="w-3.5 h-3.5" /> Add Domain
        </button>
      </div>

      {showAdd && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass rounded-xl p-4 neural-border space-y-3">
          <input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="e.g. learn.myinstitute.com" className="w-full bg-secondary/60 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
          <p className="text-[10px] text-muted-foreground">Add an A record pointing to <span className="font-mono text-primary">185.158.133.1</span> and a TXT record for verification.</p>
          <button onClick={addDomain} disabled={adding || !newDomain.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add Domain"}
          </button>
        </motion.div>
      )}

      {domains.length === 0 ? (
        <div className="glass rounded-xl p-8 neural-border text-center">
          <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No custom domains configured</p>
          <p className="text-[10px] text-muted-foreground mt-1">Default subdomain: <span className="font-mono text-primary">{institutionName.toLowerCase().replace(/\s+/g, "-")}.acry.ai</span></p>
        </div>
      ) : (
        <div className="space-y-2">
          {domains.map(domain => {
            const st = STATUS_CONFIG[domain.verification_status] || STATUS_CONFIG.pending;
            const StatusIcon = st.icon;
            return (
              <div key={domain.id} className="glass rounded-xl p-4 neural-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`w-4 h-4 ${st.color}`} />
                    <span className="text-sm font-mono font-semibold text-foreground">{domain.domain}</span>
                    {domain.is_primary && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">PRIMARY</span>}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${st.color.replace("text-", "bg-")}/15 ${st.color}`}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {domain.verification_status === "verified" && !domain.is_primary && (
                      <button onClick={() => setPrimary(domain.id)} className="px-2 py-1 rounded text-[10px] text-primary hover:bg-primary/10">Set Primary</button>
                    )}
                    <button onClick={() => deleteDomain(domain.id)} className="p-1 rounded hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                  </div>
                </div>
                {domain.verification_status === "pending" && domain.verification_token && (
                  <div className="mt-2 p-2 rounded-lg bg-secondary/40">
                    <p className="text-[10px] text-muted-foreground mb-1">Add this TXT record to verify:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{domain.verification_token}</code>
                      <span className="text-[10px] text-muted-foreground">Name: <code className="font-mono">_lovable</code></span>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Shield className="w-2.5 h-2.5" />SSL: {domain.ssl_status}</span>
                  <span>Type: {domain.domain_type}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
