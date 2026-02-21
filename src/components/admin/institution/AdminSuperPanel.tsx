import { useState, useEffect } from "react";
import {
  Building2, Users, IndianRupee, Loader2, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, BarChart3, Globe
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export default function AdminSuperPanel() {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [licenses, setLicenses] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: instData }, { data: licData }, { data: invData }] = await Promise.all([
      supabase.from("institutions").select("*").order("created_at", { ascending: false }),
      supabase.from("institution_licenses").select("*"),
      supabase.from("institution_invoices").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setInstitutions((instData as any[]) || []);
    setLicenses((licData as any[]) || []);
    setInvoices((invData as any[]) || []);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const totalStudents = institutions.reduce((s, i) => s + (i.student_count || 0), 0);
  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const activeLicenses = licenses.filter(l => l.status === "active").length;
  const expiringLicenses = licenses.filter(l => {
    if (!l.expires_at || l.status !== "active") return false;
    const diff = new Date(l.expires_at).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  });
  const pendingRevenue = invoices.filter(i => i.status === "pending").reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Enterprise Super Panel</h2>
          <p className="text-xs text-muted-foreground">All institutions • Revenue • Licenses • Usage</p>
        </div>
      </div>

      {/* Top-level KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Institutions", value: institutions.length, icon: Building2, color: "text-primary" },
          { label: "Total Students", value: totalStudents, icon: Users, color: "text-accent" },
          { label: "Active Licenses", value: activeLicenses, icon: CheckCircle2, color: "text-success" },
          { label: "Total Revenue", value: `₹${(totalRevenue / 1000).toFixed(1)}K`, icon: IndianRupee, color: "text-success" },
          { label: "Pending", value: `₹${pendingRevenue.toFixed(0)}`, icon: Clock, color: "text-warning" },
        ].map(s => (
          <div key={s.label} className="glass rounded-xl p-3 neural-border">
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{s.label}</span>
            </div>
            <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Expiring licenses warning */}
      {expiringLicenses.length > 0 && (
        <div className="glass rounded-xl p-3 neural-border border-warning/30 bg-warning/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-xs font-semibold text-warning">{expiringLicenses.length} License(s) Expiring This Week</span>
          </div>
          <div className="space-y-1">
            {expiringLicenses.map(l => (
              <div key={l.id} className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Institution: {l.institution_id.slice(0, 8)}...</span>
                <span>Expires: {format(new Date(l.expires_at), "dd MMM")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue table */}
      <div className="glass rounded-xl p-4 neural-border">
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Revenue by Institution
        </h4>
        <div className="space-y-2">
          {institutions.map(inst => {
            const instInvoices = invoices.filter(i => i.institution_id === inst.id && i.status === "paid");
            const instRevenue = instInvoices.reduce((s, i) => s + Number(i.amount), 0);
            const instLicense = licenses.find(l => l.institution_id === inst.id && l.status === "active");

            return (
              <div key={inst.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: (inst.primary_color || "#6366f1") + "20" }}>
                  <Building2 className="w-4 h-4" style={{ color: inst.primary_color || "#6366f1" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate block">{inst.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{inst.student_count || 0} students</span>
                    {instLicense && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-success/15 text-success capitalize">{instLicense.plan_name}</span>
                    )}
                    {inst.city && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" />{inst.city}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-success">₹{instRevenue.toFixed(0)}</span>
                  <p className="text-[10px] text-muted-foreground">{instInvoices.length} invoices</p>
                </div>
              </div>
            );
          })}
          {institutions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No institutions yet</p>
          )}
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="glass rounded-xl p-4 neural-border">
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" /> Recent Invoices
        </h4>
        {invoices.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No invoices</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {invoices.slice(0, 15).map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/20">
                <div className="flex items-center gap-2">
                  {inv.status === "paid" ? <CheckCircle2 className="w-3 h-3 text-success" /> : <Clock className="w-3 h-3 text-warning" />}
                  <span className="text-[10px] font-mono text-foreground">{inv.invoice_number}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground">{inv.student_count} students</span>
                  <span className="text-xs font-bold text-foreground">₹{Number(inv.amount).toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
