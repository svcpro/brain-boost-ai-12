import { useState } from "react";
import { motion } from "framer-motion";
import { Download, FileText, Table, FileSpreadsheet, Loader2, Calendar, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type ReportType = "daily" | "monthly" | "user_level";
type ExportFormat = "csv" | "txt";

export default function ExportReportsTab() {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [recentExports, setRecentExports] = useState<{ type: string; format: string; date: string }[]>([]);

  const generateReport = async (fmt: ExportFormat) => {
    setGenerating(true);
    try {
      const [chatRes, apiRes, predsRes, subsRes] = await Promise.all([
        supabase.from("chat_usage_logs").select("user_id, model_used, tokens_input, tokens_output, estimated_cost, created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("api_integrations").select("service_name, display_name, category, monthly_cost_estimate, monthly_usage_count"),
        supabase.from("model_predictions").select("user_id, model_name, latency_ms, confidence, created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("user_subscriptions").select("user_id, plan_id, status, amount, created_at").order("created_at", { ascending: false }).limit(200),
      ]);

      const chatLogs = chatRes.data || [];
      const apis = apiRes.data || [];
      const preds = predsRes.data || [];
      const subs = subsRes.data || [];

      let content = "";
      const now = format(new Date(), "yyyy-MM-dd HH:mm");

      if (fmt === "csv") {
        if (reportType === "daily") {
          content = "Date,Category,Item,Requests,Cost_INR\n";
          content += `${now},AI Chat,Total Requests,${chatLogs.length},${Math.round(chatLogs.reduce((s, l) => s + (l.estimated_cost || 0) * 83, 0))}\n`;
          content += `${now},Predictions,Total Predictions,${preds.length},${Math.round(preds.length * 0.004)}\n`;
          for (const api of apis) {
            content += `${now},API,${api.display_name},${api.monthly_usage_count || 0},${Math.round((api.monthly_cost_estimate || 0) * 83)}\n`;
          }
        } else if (reportType === "monthly") {
          content = "Service,Category,Monthly_Requests,Monthly_Cost_INR,Cost_Per_Request\n";
          for (const api of apis) {
            const costInr = (api.monthly_cost_estimate || 0) * 83;
            const costPerReq = api.monthly_usage_count ? costInr / api.monthly_usage_count : 0;
            content += `${api.display_name},${api.category},${api.monthly_usage_count || 0},${Math.round(costInr)},${costPerReq.toFixed(3)}\n`;
          }
          content += `AI Chat,ai,${chatLogs.length},${Math.round(chatLogs.reduce((s, l) => s + (l.estimated_cost || 0) * 83, 0))},${(chatLogs.length > 0 ? chatLogs.reduce((s, l) => s + (l.estimated_cost || 0) * 83, 0) / chatLogs.length : 0).toFixed(3)}\n`;
        } else {
          content = "User_ID,Chat_Requests,Chat_Cost_INR,Predictions,Prediction_Cost_INR,Subscription,Amount\n";
          const userMap = new Map<string, { chats: number; chatCost: number; preds: number; predCost: number; plan: string; amount: number }>();
          for (const l of chatLogs) {
            const u = userMap.get(l.user_id) || { chats: 0, chatCost: 0, preds: 0, predCost: 0, plan: "free", amount: 0 };
            u.chats++; u.chatCost += (l.estimated_cost || 0) * 83;
            userMap.set(l.user_id, u);
          }
          for (const p of preds) {
            const u = userMap.get(p.user_id) || { chats: 0, chatCost: 0, preds: 0, predCost: 0, plan: "free", amount: 0 };
            u.preds++; u.predCost += 0.004;
            userMap.set(p.user_id, u);
          }
          for (const s of subs) {
            const u = userMap.get(s.user_id) || { chats: 0, chatCost: 0, preds: 0, predCost: 0, plan: "free", amount: 0 };
            u.plan = s.plan_id; u.amount = s.amount || 0;
            userMap.set(s.user_id, u);
          }
          for (const [uid, u] of userMap) {
            content += `${uid},${u.chats},${u.chatCost.toFixed(2)},${u.preds},${u.predCost.toFixed(2)},${u.plan},${u.amount}\n`;
          }
        }
      } else {
        content = `ACRY Cost Report - ${reportType.replace("_", " ").toUpperCase()}\n`;
        content += `Generated: ${now}\n`;
        content += `${"=".repeat(50)}\n\n`;
        content += `Total AI Chat Requests: ${chatLogs.length}\n`;
        content += `Total AI Chat Cost: ₹${Math.round(chatLogs.reduce((s, l) => s + (l.estimated_cost || 0) * 83, 0))}\n`;
        content += `Total Predictions: ${preds.length}\n`;
        content += `Total API Services: ${apis.length}\n`;
        content += `Total API Cost: ₹${Math.round(apis.reduce((s, a) => s + (a.monthly_cost_estimate || 0) * 83, 0))}\n`;
        content += `\nAPI Breakdown:\n`;
        for (const api of apis) {
          content += `  ${api.display_name}: ₹${Math.round((api.monthly_cost_estimate || 0) * 83)} (${api.monthly_usage_count || 0} calls)\n`;
        }
      }

      // Download
      const blob = new Blob([content], { type: fmt === "csv" ? "text/csv" : "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `acry-cost-${reportType}-${format(new Date(), "yyyyMMdd")}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);

      setRecentExports(prev => [{ type: reportType, format: fmt, date: now }, ...prev.slice(0, 4)]);
      toast({ title: "📊 Report Downloaded", description: `${reportType} report exported as ${fmt.toUpperCase()}` });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5 mt-4">
      {/* Report Type */}
      <div className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> Select Report Type
        </h4>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: "daily", label: "Daily Report", desc: "Today's cost breakdown" },
            { key: "monthly", label: "Monthly Report", desc: "Full monthly P&L" },
            { key: "user_level", label: "User-Level Report", desc: "Per-user cost analysis" },
          ].map(r => (
            <button key={r.key} onClick={() => setReportType(r.key as ReportType)}
              className={`p-3 rounded-xl text-left transition-all ${reportType === r.key ? "bg-primary/15 border border-primary/30" : "bg-secondary/30 hover:bg-secondary/50"}`}>
              <p className="text-sm font-medium text-foreground">{r.label}</p>
              <p className="text-[10px] text-muted-foreground">{r.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Export Formats */}
      <div className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
          <Download className="w-4 h-4 text-accent" /> Export Format
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "csv", label: "CSV", desc: "Spreadsheet compatible", icon: Table },
            { key: "txt", label: "Text Report", desc: "Human-readable summary", icon: FileText },
          ].map(f => (
            <button key={f.key} onClick={() => generateReport(f.key as ExportFormat)}
              disabled={generating}
              className="flex items-center gap-3 p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all disabled:opacity-50">
              {generating ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <f.icon className="w-5 h-5 text-primary" />}
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">{f.label}</p>
                <p className="text-[10px] text-muted-foreground">{f.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Exports */}
      {recentExports.length > 0 && (
        <div className="glass rounded-xl neural-border p-4">
          <h4 className="text-xs font-semibold text-foreground mb-3">Recent Exports</h4>
          <div className="space-y-2">
            {recentExports.map((e, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 text-[10px]">
                <CheckCircle className="w-3 h-3 text-success" />
                <span className="text-foreground font-medium capitalize">{e.type.replace("_", " ")} Report</span>
                <span className="text-muted-foreground">{e.format.toUpperCase()}</span>
                <span className="text-muted-foreground ml-auto">{e.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
