import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, RotateCcw, X, BookOpen, Hash, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TrashedSubject {
  id: string;
  name: string;
  deleted_at: string;
  topic_count: number;
}

interface TrashedTopic {
  id: string;
  name: string;
  deleted_at: string;
  subject_name: string;
  subject_id: string;
}

const TrashBin = ({ onTrashChanged }: { onTrashChanged?: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [trashedSubjects, setTrashedSubjects] = useState<TrashedSubject[]>([]);
  const [trashedTopics, setTrashedTopics] = useState<TrashedTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<{ type: "subject" | "topic"; id: string; name: string } | null>(null);
  const [showEmptyTrashDialog, setShowEmptyTrashDialog] = useState(false);

  const loadTrashed = async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: subjects }, { data: topics }] = await Promise.all([
      supabase
        .from("subjects")
        .select("id, name, deleted_at")
        .eq("user_id", user.id)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      supabase
        .from("topics")
        .select("id, name, deleted_at, subject_id, subjects(name)")
        .eq("user_id", user.id)
        .not("deleted_at", "is", null)
        .is("subjects.deleted_at", null) // Only show topics whose parent subject isn't also trashed
        .order("deleted_at", { ascending: false }),
    ]);

    if (subjects) {
      const withCounts: TrashedSubject[] = [];
      for (const s of subjects) {
        const { count } = await supabase
          .from("topics")
          .select("*", { count: "exact", head: true })
          .eq("subject_id", s.id);
        withCounts.push({ ...s, deleted_at: s.deleted_at!, topic_count: count ?? 0 });
      }
      setTrashedSubjects(withCounts);
    }

    if (topics) {
      setTrashedTopics(
        topics
          .filter((t: any) => t.subjects)
          .map((t: any) => ({
            id: t.id,
            name: t.name,
            deleted_at: t.deleted_at!,
            subject_name: t.subjects?.name || "Unknown",
            subject_id: t.subject_id,
          }))
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    loadTrashed();
  }, [user]);

  const restoreSubject = async (id: string) => {
    const { error } = await supabase
      .from("subjects")
      .update({ deleted_at: null })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Also restore all topics under this subject
    await supabase
      .from("topics")
      .update({ deleted_at: null })
      .eq("subject_id", id);

    toast({ title: "↩️ Subject restored" });
    loadTrashed();
    onTrashChanged?.();
  };

  const restoreTopic = async (id: string) => {
    const { error } = await supabase
      .from("topics")
      .update({ deleted_at: null })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "↩️ Topic restored" });
    loadTrashed();
    onTrashChanged?.();
  };

  const permanentlyDelete = async () => {
    if (!permanentDeleteTarget) return;
    const { type, id } = permanentDeleteTarget;

    if (type === "subject") {
      await supabase.from("topics").delete().eq("subject_id", id);
      await supabase.from("subjects").delete().eq("id", id);
    } else {
      await supabase.from("topics").delete().eq("id", id);
    }

    toast({ title: "🗑️ Permanently deleted" });
    setPermanentDeleteTarget(null);
    loadTrashed();
    onTrashChanged?.();
  };

  const emptyTrash = async () => {
    if (!user) return;

    for (const s of trashedSubjects) {
      await supabase.from("topics").delete().eq("subject_id", s.id);
      await supabase.from("subjects").delete().eq("id", s.id);
    }

    for (const t of trashedTopics) {
      await supabase.from("topics").delete().eq("id", t.id);
    }

    toast({ title: "🗑️ Trash emptied" });
    setShowEmptyTrashDialog(false);
    loadTrashed();
    onTrashChanged?.();
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const totalItems = trashedSubjects.length + trashedTopics.length;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div className="glass rounded-xl p-4 neural-border space-y-3 mt-1">
        {loading ? (
          <p className="text-xs text-muted-foreground text-center py-4">Loading trash...</p>
        ) : totalItems === 0 ? (
          <div className="text-center py-6">
            <Trash2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Trash is empty</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">Deleted subjects and topics will appear here</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{totalItems} item{totalItems !== 1 ? "s" : ""} in trash</span>
              <button
                onClick={() => setShowEmptyTrashDialog(true)}
                className="text-xs text-destructive hover:text-destructive/80 font-medium transition-colors"
              >
                Empty Trash
              </button>
            </div>

            {/* Trashed Subjects */}
            {trashedSubjects.map(sub => (
              <div key={sub.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-secondary/30 border border-border">
                <BookOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground line-through truncate">{sub.name}</p>
                  <p className="text-[10px] text-muted-foreground/60">{sub.topic_count} topic{sub.topic_count !== 1 ? "s" : ""} · {formatTimeAgo(sub.deleted_at)}</p>
                </div>
                <button
                  onClick={() => restoreSubject(sub.id)}
                  className="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors"
                  title="Restore"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPermanentDeleteTarget({ type: "subject", id: sub.id, name: sub.name })}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                  title="Delete permanently"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Trashed Topics */}
            {trashedTopics.map(topic => (
              <div key={topic.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-secondary/30 border border-border">
                <Hash className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground line-through truncate">{topic.name}</p>
                  <p className="text-[10px] text-muted-foreground/60">from {topic.subject_name} · {formatTimeAgo(topic.deleted_at)}</p>
                </div>
                <button
                  onClick={() => restoreTopic(topic.id)}
                  className="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors"
                  title="Restore"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPermanentDeleteTarget({ type: "topic", id: topic.id, name: topic.name })}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                  title="Delete permanently"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Permanent Delete Confirmation */}
      <AlertDialog open={!!permanentDeleteTarget} onOpenChange={(open) => { if (!open) setPermanentDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete "{permanentDeleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The {permanentDeleteTarget?.type} and all its data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={permanentlyDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty Trash Confirmation */}
      <AlertDialog open={showEmptyTrashDialog} onOpenChange={setShowEmptyTrashDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty trash?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {totalItems} item{totalItems !== 1 ? "s" : ""} in the trash. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={emptyTrash} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Empty Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default TrashBin;
