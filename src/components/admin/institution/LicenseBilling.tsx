import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CreditCard, IndianRupee, Loader2, Plus, Calendar, FileText,
  CheckCircle2, AlertTriangle, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface License {
  id: string;
  institution_id: string;
  plan_name: string;
  max_students: number;
  price_per_student: number;
  billing_cycle: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  auto_renew: boolean;
}

interface Invoice {
  id: string;
  institution_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  student_count: number;
  billing_period_start: string | null;
  billing_period_end: string | null;
  paid_at: string | null;
  created_at: string;
}

interface Props {
  institutionId: string;
  institutionName: string;
}

export default function LicenseBilling({ institutionId, institutionName }: Props) {
  const { toast } = useToast();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPlan, setNewPlan] = useState("starter");
  const [newMaxStudents, setNewMaxStudents] = useState(50);
  const [newPrice, setNewPrice] = useState(99);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  useEffect(() => { loadData(); }, [institutionId]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: licData }, { data: invData }] = await Promise.all([
      supabase.from("institution_licenses").select("*").eq("institution_id", institutionId).order("created_at", { ascending: false }),
      supabase.from("institution_invoices").select("*").eq("institution_id", institutionId).order("created_at", { ascending: false }),
    ]);
    setLicenses((licData as any[]) || []);
    setInvoices((invData as any[]) || []);
    setLoading(false);
  };

  const createLicense = async () => {
    setCreating(true);
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + (newPlan === "annual" ? 12 : 1));

    const { error } = await supabase.from("institution_licenses").insert({
      institution_id: institutionId,
      plan_name: newPlan,
      max_students: newMaxStudents,
      price_per_student: newPrice,
      billing_cycle: newPlan === "annual" ? "annual" : "monthly",
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "License created ✅" });
      setShowCreate(false);
      loadData();
    }
    setCreating(false);
  };

  const generateInvoice = async (license: License) => {
    setGeneratingInvoice(true);
    // Count current students
    const { count } = await supabase
      .from("batch_students")
      .select("*", { count: "exact", head: true })
      .in("batch_id", (await supabase.from("institution_batches").select("id").eq("institution_id", institutionId)).data?.map((b: any) => b.id) || []);

    const studentCount = count || 0;
    const amount = studentCount * license.price_per_student;
    const now = new Date();
    const invoiceNum = `INV-${institutionId.slice(0, 4).toUpperCase()}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;

    const { error } = await supabase.from("institution_invoices").insert({
      institution_id: institutionId,
      license_id: license.id,
      invoice_number: invoiceNum,
      amount,
      student_count: studentCount,
      billing_period_start: now.toISOString().split("T")[0],
      billing_period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0],
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Invoice generated: ₹${amount.toFixed(2)}` });
      loadData();
    }
    setGeneratingInvoice(false);
  };

  const STATUS_ICONS: Record<string, any> = {
    paid: <CheckCircle2 className="w-3.5 h-3.5 text-success" />,
    pending: <Clock className="w-3.5 h-3.5 text-warning" />,
    overdue: <AlertTriangle className="w-3.5 h-3.5 text-destructive" />,
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const activeLicense = licenses.find(l => l.status === "active");
  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-success/20 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-success" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">License & Billing</h3>
          <p className="text-[10px] text-muted-foreground">{institutionName}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active Plan", value: activeLicense?.plan_name || "None", color: "text-primary" },
          { label: "Max Students", value: activeLicense?.max_students || 0, color: "text-foreground" },
          { label: "₹/Student", value: `₹${activeLicense?.price_per_student || 0}`, color: "text-accent" },
          { label: "Total Revenue", value: `₹${totalRevenue.toFixed(0)}`, color: "text-success" },
        ].map(s => (
          <div key={s.label} className="glass rounded-xl p-3 neural-border">
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Active License */}
      {activeLicense && (
        <div className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-foreground">Active License</h4>
            <button
              onClick={() => generateInvoice(activeLicense)}
              disabled={generatingInvoice}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
            >
              {generatingInvoice ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              Generate Invoice
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-2 rounded-lg bg-secondary/40">
              <span className="text-[10px] text-muted-foreground">Plan</span>
              <p className="text-xs font-semibold text-foreground capitalize">{activeLicense.plan_name}</p>
            </div>
            <div className="p-2 rounded-lg bg-secondary/40">
              <span className="text-[10px] text-muted-foreground">Billing</span>
              <p className="text-xs font-semibold text-foreground capitalize">{activeLicense.billing_cycle}</p>
            </div>
            <div className="p-2 rounded-lg bg-secondary/40">
              <span className="text-[10px] text-muted-foreground">Auto-Renew</span>
              <p className="text-xs font-semibold text-foreground">{activeLicense.auto_renew ? "Yes" : "No"}</p>
            </div>
            <div className="p-2 rounded-lg bg-secondary/40">
              <span className="text-[10px] text-muted-foreground">Expires</span>
              <p className="text-xs font-semibold text-foreground">
                {activeLicense.expires_at ? format(new Date(activeLicense.expires_at), "dd MMM yyyy") : "No expiry"}
              </p>
            </div>
          </div>
        </div>
      )}

      {!activeLicense && (
        <div className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-foreground">No Active License</h4>
            <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
              <Plus className="w-3 h-3" /> Create License
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass rounded-xl p-4 neural-border space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Plan</label>
              <select value={newPlan} onChange={e => setNewPlan(e.target.value)} className="w-full bg-secondary/60 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground">
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="enterprise">Enterprise</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Max Students</label>
              <input type="number" value={newMaxStudents} onChange={e => setNewMaxStudents(Number(e.target.value))} className="w-full bg-secondary/60 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">₹/Student</label>
              <input type="number" value={newPrice} onChange={e => setNewPrice(Number(e.target.value))} className="w-full bg-secondary/60 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground" />
            </div>
          </div>
          <button onClick={createLicense} disabled={creating} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create License"}
          </button>
        </motion.div>
      )}

      {/* Invoices */}
      <div className="glass rounded-xl p-4 neural-border">
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <IndianRupee className="w-4 h-4 text-primary" /> Invoice History
        </h4>
        {invoices.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No invoices yet</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {invoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30">
                <div className="flex items-center gap-2">
                  {STATUS_ICONS[inv.status] || STATUS_ICONS.pending}
                  <div>
                    <span className="text-xs font-mono font-medium text-foreground">{inv.invoice_number}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{inv.student_count} students</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-foreground">₹{Number(inv.amount).toFixed(0)}</span>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(inv.created_at), "dd MMM yyyy")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
