import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, Plus, Search, Loader2, GraduationCap, Calendar,
  ToggleLeft, ToggleRight, Trash2, Upload, Download
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Batch {
  id: string;
  institution_id: string;
  name: string;
  description: string | null;
  academic_year: string | null;
  start_date: string | null;
  end_date: string | null;
  max_students: number;
  is_active: boolean;
  created_at: string;
}

interface BatchStudent {
  id: string;
  batch_id: string;
  student_user_id: string;
  enrolled_at: string;
  is_active: boolean;
  roll_number: string | null;
}

interface Props {
  institutionId: string;
  institutionName: string;
}

export default function BatchManagement({ institutionId, institutionName }: Props) {
  const { toast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [students, setStudents] = useState<BatchStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadBatches(); }, [institutionId]);

  const loadBatches = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("institution_batches")
      .select("*")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false });
    setBatches((data as any[]) || []);
    setLoading(false);
  };

  const createBatch = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    const { error } = await supabase.from("institution_batches").insert({
      institution_id: institutionId,
      name: newName.trim(),
      academic_year: newYear,
      created_by: user.id,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Batch created ✅" });
      setNewName("");
      setShowCreate(false);
      loadBatches();
    }
    setCreating(false);
  };

  const toggleBatch = async (batch: Batch) => {
    await supabase.from("institution_batches").update({ is_active: !batch.is_active }).eq("id", batch.id);
    loadBatches();
  };

  const deleteBatch = async (batchId: string) => {
    if (!confirm("Delete this batch and all student assignments?")) return;
    await supabase.from("institution_batches").delete().eq("id", batchId);
    if (selectedBatch?.id === batchId) setSelectedBatch(null);
    loadBatches();
  };

  const loadStudents = async (batchId: string) => {
    setStudentsLoading(true);
    const { data } = await supabase
      .from("batch_students")
      .select("*")
      .eq("batch_id", batchId)
      .order("enrolled_at", { ascending: false });
    setStudents((data as any[]) || []);
    setStudentsLoading(false);
  };

  const selectBatch = (batch: Batch) => {
    setSelectedBatch(batch);
    loadStudents(batch.id);
  };

  const handleCSVUpload = async () => {
    if (!csvFile || !selectedBatch) return;
    setUploading(true);
    try {
      const text = await csvFile.text();
      const lines = text.split("\n").filter(l => l.trim());
      const header = lines[0].toLowerCase();
      const hasHeader = header.includes("user_id") || header.includes("email") || header.includes("roll");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      let inserted = 0;
      for (const line of dataLines) {
        const cols = line.split(",").map(c => c.trim());
        if (cols.length < 1 || !cols[0]) continue;

        const { error } = await supabase.from("batch_students").insert({
          batch_id: selectedBatch.id,
          student_user_id: cols[0],
          roll_number: cols[1] || null,
        });
        if (!error) inserted++;
      }

      toast({ title: `${inserted} students uploaded ✅` });
      loadStudents(selectedBatch.id);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
    setUploading(false);
    setCsvFile(null);
  };

  const removeStudent = async (studentId: string) => {
    await supabase.from("batch_students").delete().eq("id", studentId);
    if (selectedBatch) loadStudents(selectedBatch.id);
  };

  const filtered = batches.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Batches & Classes</h3>
          <p className="text-[10px] text-muted-foreground">{institutionName}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search batches..."
            className="w-full bg-secondary/60 border border-border/50 rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
        >
          <Plus className="w-3.5 h-3.5" /> New Batch
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass rounded-xl p-4 neural-border space-y-3">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Batch name (e.g. JEE 2026 Batch A)"
            className="w-full bg-secondary/60 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <div className="flex gap-2 items-center">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={newYear}
              onChange={e => setNewYear(e.target.value)}
              placeholder="Academic year"
              className="bg-secondary/60 border border-border/50 rounded-lg px-3 py-2 text-xs text-foreground w-32 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <button onClick={createBatch} disabled={creating || !newName.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create Batch"}
          </button>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Batches", value: batches.length },
          { label: "Active", value: batches.filter(b => b.is_active).length },
          { label: "Total Capacity", value: batches.reduce((s, b) => s + b.max_students, 0) },
        ].map(s => (
          <div key={s.label} className="glass rounded-xl p-3 neural-border text-center">
            <span className="text-lg font-bold text-foreground">{s.value}</span>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Batch List */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No batches found</p>
          ) : filtered.map(batch => (
            <motion.div
              key={batch.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => selectBatch(batch)}
              className={`glass rounded-xl p-3 neural-border cursor-pointer transition-colors ${selectedBatch?.id === batch.id ? "ring-1 ring-primary/40" : "hover:bg-secondary/30"}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-foreground">{batch.name}</span>
                  {batch.academic_year && <span className="ml-2 text-[10px] text-muted-foreground">{batch.academic_year}</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={e => { e.stopPropagation(); toggleBatch(batch); }} className="p-1 rounded hover:bg-secondary">
                    {batch.is_active ? <ToggleRight className="w-3.5 h-3.5 text-success" /> : <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteBatch(batch.id); }} className="p-1 rounded hover:bg-destructive/10">
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" /> Max {batch.max_students}
                </span>
                <span className={`text-[10px] ${batch.is_active ? "text-success" : "text-muted-foreground"}`}>
                  {batch.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Student Panel */}
        <div className="glass rounded-xl p-4 neural-border">
          {selectedBatch ? (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {selectedBatch.name} — Students ({students.length})
              </h4>

              {/* CSV Upload */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 text-xs text-muted-foreground hover:text-foreground cursor-pointer border border-border/50">
                  <Upload className="w-3.5 h-3.5" />
                  {csvFile ? csvFile.name : "Upload CSV"}
                  <input type="file" accept=".csv" className="hidden" onChange={e => setCsvFile(e.target.files?.[0] || null)} />
                </label>
                {csvFile && (
                  <button onClick={handleCSVUpload} disabled={uploading} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
                    {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Import"}
                  </button>
                )}
              </div>
              <p className="text-[9px] text-muted-foreground">CSV format: user_id, roll_number (one per line)</p>

              {/* Student list */}
              {studentsLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
              ) : students.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No students enrolled</p>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {students.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center">
                          <Users className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-foreground">{s.student_user_id.slice(0, 8)}...</span>
                          {s.roll_number && <span className="ml-2 text-[10px] text-muted-foreground">#{s.roll_number}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] ${s.is_active ? "text-success" : "text-muted-foreground"}`}>
                          {s.is_active ? "Active" : "Inactive"}
                        </span>
                        <button onClick={() => removeStudent(s.id)} className="p-1 rounded hover:bg-destructive/10">
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Select a batch to manage students</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
