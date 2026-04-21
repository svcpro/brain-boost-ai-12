import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Loader2, Upload, Pencil } from "lucide-react";

interface Props {
  open: boolean;
  blob: Blob | null;
  uploading: boolean;
  onCancel: () => void;
  onRecrop: () => void;
  onConfirm: () => void;
}

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const AvatarPreviewDialog = ({ open, blob, uploading, onCancel, onRecrop, onConfirm }: Props) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  return (
    <AnimatePresence>
      {open && blob && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-background/95 backdrop-blur-md flex items-center justify-center p-4"
          onClick={uploading ? undefined : onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="w-full max-w-md bg-card rounded-3xl border border-border shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div>
                <h3 className="text-sm font-bold text-foreground">Looks good?</h3>
                <p className="text-[10px] text-muted-foreground">Preview before uploading to your profile</p>
              </div>
              <button
                onClick={onCancel}
                disabled={uploading}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Preview */}
            <div className="px-5 py-6 flex flex-col items-center gap-4 bg-gradient-to-b from-secondary/30 to-transparent">
              <div className="flex items-end gap-5">
                {/* Large round preview */}
                <div className="relative">
                  <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-background shadow-2xl shadow-primary/20">
                    {url && <img src={url} alt="Avatar preview" className="w-full h-full object-cover" />}
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider shadow-lg">
                    Profile
                  </div>
                </div>

                {/* Small previews — show how it looks at common sizes */}
                <div className="flex flex-col items-center gap-2 pb-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-background shadow-md">
                    {url && <img src={url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <span className="text-[8px] text-muted-foreground font-semibold">Comments</span>
                </div>
                <div className="flex flex-col items-center gap-2 pb-3">
                  <div className="w-7 h-7 rounded-full overflow-hidden ring-2 ring-background shadow">
                    {url && <img src={url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <span className="text-[8px] text-muted-foreground font-semibold">Nav</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="px-2 py-0.5 rounded-full bg-secondary font-semibold tabular-nums">
                  512 × 512
                </span>
                <span className="px-2 py-0.5 rounded-full bg-secondary font-semibold tabular-nums">
                  {formatBytes(blob.size)}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-secondary font-semibold uppercase">
                  JPEG
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-5 pb-5 pt-2">
              <button
                onClick={onRecrop}
                disabled={uploading}
                className="flex-1 px-3 py-2.5 rounded-xl bg-secondary text-xs font-semibold text-foreground hover:bg-secondary/70 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" />
                Re-crop
              </button>
              <button
                onClick={onCancel}
                disabled={uploading}
                className="flex-1 px-3 py-2.5 rounded-xl bg-secondary text-xs font-semibold text-foreground hover:bg-secondary/70 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={uploading}
                className="flex-[1.4] px-3 py-2.5 rounded-xl bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Use this photo
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AvatarPreviewDialog;
