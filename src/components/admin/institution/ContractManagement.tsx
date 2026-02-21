import { useState, useEffect } from "react";
import {
  FileText, IndianRupee, Loader2, Plus, CheckCircle2, Clock,
  AlertTriangle, Shield, Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { motion } from "framer-motion";

interface Contract {
  id: string;
  institution_id: string;
  contract_number: string;
  contract_type: string;
  setup_fee: number;
  monthly_fee: number;
  annual_fee: number | null;
  billing_cycle: string;
  sla_tier: string;
  sla_uptime_guarantee: number;
  sla_support_response_hours: number;
  starts_at: string;
  expires_at: string | null;
  status: string;
  auto_renew: boolean;
  signed_at: string | null;
  signed_by: string | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  institutionId: string;
  institutionName: string;
}

export default function ContractManagement({ institutionId, institutionName }: Props) {
  const { toast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    contract_type: "standard",
    setup_fee: 0,
    monthly_fee: 4999,
    billing_cycle: "monthly",
    sla_tier: "standard",
    notes: "",
  });

  useEffect(() => { loadContracts(); }, [institutionId]);

  const loadContracts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("whitelabel_contracts")
      .select("*")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false });
    setContracts((data as any[]) || []);
    setLoading(false);
  };

  const createContract = async () => {
    setCreating(true);
    const now = new Date();
    const contractNum = `WL-${institutionId.slice(0, 4).toUpperCase()}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const slaConfig: Record<string, { uptime: number; response: number }> = {
      basic: { uptime: 99.0, response: 48 },
      standard: { uptime: 99.5, response: 24 },
      premium: { uptime: 99.9, response: 4 },
      enterprise: { uptime: 99.99, response: 1 },
    };
    const sla = slaConfig[form.sla_tier] || slaConfig.standard;

    const { error } = await supabase.from("whitelabel_contracts").insert({
      institution_id: institutionId,
      contract_number: contractNum,
      contract_type: form.contract_type,
      setup_fee: form.setup_fee,
      monthly_fee: form.monthly_fee,
      billing_cycle: form.billing_cycle,
      sla_tier: form.sla_tier,
      sla_uptime_guarantee: sla.uptime,
      sla_support_response_hours: sla.response,
      expires_at: expiresAt.toISOString(),
      notes: form.notes || null,
    });

    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Contract created ✅" }); setShowCreate(false); loadContracts(); }
    setCreating(false);
  };

  const STATUS_MAP: Record<string, { icon: any; color: string }> = {
    active: { icon: CheckCircle2, color: "text-success" },
    pending: { icon: Clock, color: "text-warning" },
    expired: { icon: AlertTriangle, color: "text-destructive" },
    cancelled: { icon: AlertTriangle, color: "text-muted-foreground" },
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const activeContract = contracts.find(c => c.status === "active");
  const totalSetupFees = contracts.reduce((s, c) => s + Number(c.setup_fee), 0);
  const monthlyRevenue = activeContract ? Number(activeContract.monthly_fee) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-success/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-success" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">SaaS Contracts</h3>
            <p className="text-[10px] text-muted-foreground">{institutionName}</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
          <Plus className="w-3.5 h-3.5" /> New Contract
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Contracts", value: contracts.length },
          { label: "Active", value: contracts.filter(c => c.status === "active").length },
          { label: "Monthly Revenue", value: `₹${monthlyRevenue.toLocaleString()}` },
          { label: "Setup Fees", value: `₹${totalSetupFees.toLocaleString()}` },
        ].map(s => (
          <div key={s.label} className="glass rounded-xl p-3 neural-border">
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
            <p className="text-lg font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass rounded-xl p-4 neural-border space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground">Type</label>
              <select value={form.contract_type} onChange={e => setForm(p => ({ ...p, contract_type: e.target.value }))} className="w-full bg-secondary/60 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground mt-1">
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Setup Fee (₹)</label>
              <input type="number" value={form.setup_fee} onChange={e => setForm(p => ({ ...p, setup_fee: Number(e.target.value) }))} className="w-full bg-secondary/60 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground mt-1" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Monthly Fee (₹)</label>
              <input type="number" value={form.monthly_fee} onChange={e => setForm(p => ({ ...p, monthly_fee: Number(e.target.value) }))} className="w-full bg-secondary/60 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground mt-1" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Billing Cycle</label>
              <select value={form.billing_cycle} onChange={e => setForm(p => ({ ...p, billing_cycle: e.target.value }))} className="w-full bg-secondary/60 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground mt-1">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">SLA Tier</label>
              <select value={form.sla_tier} onChange={e => setForm(p => ({ ...p, sla_tier: e.target.value }))} className="w-full bg-secondary/60 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground mt-1">
                <option value="basic">Basic (99% / 48h)</option>
                <option value="standard">Standard (99.5% / 24h)</option>
                <option value="premium">Premium (99.9% / 4h)</option>
                <option value="enterprise">Enterprise (99.99% / 1h)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full bg-secondary/60 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground mt-1" />
          </div>
          <button onClick={createContract} disabled={creating} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create Contract"}
          </button>
        </motion.div>
      )}

      {/* Contract List */}
      <div className="space-y-2">
        {contracts.length === 0 ? (
          <div className="glass rounded-xl p-8 neural-border text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No contracts yet</p>
          </div>
        ) : contracts.map(contract => {
          const st = STATUS_MAP[contract.status] || STATUS_MAP.pending;
          const StatusIcon = st.icon;
          return (
            <div key={contract.id} className="glass rounded-xl p-4 neural-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <StatusIcon className={`w-4 h-4 ${st.color}`} />
                  <span className="text-xs font-mono font-semibold text-foreground">{contract.contract_number}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${contract.status === "active" ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"}`}>{contract.status}</span>
                </div>
                <span className="text-sm font-bold text-primary">₹{Number(contract.monthly_fee).toLocaleString()}/mo</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[10px]">
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="text-foreground font-medium capitalize">{contract.contract_type}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Setup Fee</span>
                  <p className="text-foreground font-medium">₹{Number(contract.setup_fee).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-0.5"><Shield className="w-2.5 h-2.5" />SLA</span>
                  <p className="text-foreground font-medium">{contract.sla_uptime_guarantee}% / {contract.sla_support_response_hours}h</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Billing</span>
                  <p className="text-foreground font-medium capitalize">{contract.billing_cycle}</p>
                </div>
                <div>
                  <span className="text-muted-foreground flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />Expires</span>
                  <p className="text-foreground font-medium">{contract.expires_at ? format(new Date(contract.expires_at), "dd MMM yyyy") : "—"}</p>
                </div>
              </div>
              {contract.notes && <p className="text-[10px] text-muted-foreground mt-2 italic">{contract.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
