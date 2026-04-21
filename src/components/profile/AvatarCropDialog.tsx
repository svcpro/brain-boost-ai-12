import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, ZoomIn, RotateCw, Loader2 } from "lucide-react";

interface Props {
  imageSrc: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: (croppedBlob: Blob) => Promise<void> | void;
  /** Original image width in pixels (before any client-side resize). */
  sourceWidth?: number;
  /** Original image height in pixels (before any client-side resize). */
  sourceHeight?: number;
  /** Original file size in bytes (before any client-side resize). */
  sourceBytes?: number;
  /** True if the source was downscaled before being passed in. */
  resized?: boolean;
}

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", e => reject(e));
    img.crossOrigin = "anonymous";
    img.src = url;
  });

const getCroppedBlob = async (
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  outputSize = 512,
): Promise<Blob> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");

  // Output square avatar
  canvas.width = outputSize;
  canvas.height = outputSize;

  // Compute rotated source via offscreen canvas
  const safeArea = Math.max(image.width, image.height) * 2;
  const off = document.createElement("canvas");
  const offCtx = off.getContext("2d")!;
  off.width = safeArea;
  off.height = safeArea;

  offCtx.translate(safeArea / 2, safeArea / 2);
  offCtx.rotate((rotation * Math.PI) / 180);
  offCtx.translate(-image.width / 2, -image.height / 2);
  offCtx.drawImage(image, 0, 0);

  const sx = safeArea / 2 - image.width / 2 + pixelCrop.x;
  const sy = safeArea / 2 - image.height / 2 + pixelCrop.y;

  ctx.drawImage(
    off,
    sx, sy, pixelCrop.width, pixelCrop.height,
    0, 0, outputSize, outputSize,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.92);
  });
};

const AvatarCropDialog = ({ imageSrc, open, onCancel, onConfirm, sourceWidth, sourceHeight, sourceBytes, resized }: Props) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!pixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, pixels, rotation);
      await onConfirm(blob);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex items-center justify-center p-4"
          onClick={onCancel}
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
            <div className="px-5 py-3.5 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-foreground">Crop Photo</h3>
                  <p className="text-[10px] text-muted-foreground">Drag to reposition · Pinch to zoom</p>
                </div>
                <button
                  onClick={onCancel}
                  disabled={saving}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 shrink-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Detected source metadata */}
              {(sourceWidth || sourceBytes) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {sourceWidth && sourceHeight && (
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] font-semibold text-foreground tabular-nums">
                      {sourceWidth} × {sourceHeight} px
                    </span>
                  )}
                  {sourceBytes !== undefined && (
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] font-semibold text-foreground tabular-nums">
                      {formatBytes(sourceBytes)}
                    </span>
                  )}
                  {resized && (
                    <span className="px-2 py-0.5 rounded-full bg-primary/15 text-[10px] font-semibold text-primary uppercase tracking-wider">
                      Auto-resized
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Crop area */}
            <div className="relative h-80 bg-black">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Controls */}
            <div className="px-5 py-4 space-y-3">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <ZoomIn className="w-3 h-3" />
                  Zoom
                </label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={e => setZoom(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-semibold text-foreground hover:bg-secondary/70 transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Rotate
                </button>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {Math.round(zoom * 100)}% · {rotation}°
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={onCancel}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-xl bg-secondary text-sm font-semibold text-foreground hover:bg-secondary/70 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving || !pixels}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {saving ? "Uploading..." : "Save"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AvatarCropDialog;
