import React, { useRef, useState, useCallback, useEffect } from 'react';

interface ImageCropperProps {
  imageSrc: string;
  aspectRatio: number;          // width / height  e.g. 3 for cover, 1 for avatar
  minWidth?: number;            // px – warn if output is too small
  minHeight?: number;
  onCrop: (blob: Blob, previewUrl: string) => void;
  onCancel: () => void;
  label?: string;
}

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const HANDLE_SIZE = 10;

export default function ImageCropper({
  imageSrc,
  aspectRatio,
  minWidth = 0,
  minHeight = 0,
  onCrop,
  onCancel,
  label = 'Crop Image',
}: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 400 });
  const [cropBox, setCropBox] = useState<CropBox>({ x: 0, y: 0, w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const [sizeWarning, setSizeWarning] = useState('');

  // drag state (ref to avoid re-renders during mousemove)
  const dragState = useRef<{
    active: boolean;
    type: 'move' | 'resize-br' | 'resize-bl' | 'resize-tr' | 'resize-tl';
    startX: number; startY: number;
    startBox: CropBox;
  }>({ active: false, type: 'move', startX: 0, startY: 0, startBox: { x: 0, y: 0, w: 0, h: 0 } });

  // ---------- load image & init crop box ----------
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const maxW = Math.min(800, window.innerWidth - 80);
      const scale = maxW / img.naturalWidth;
      const dispW = Math.round(img.naturalWidth * scale);
      const dispH = Math.round(img.naturalHeight * scale);
      setCanvasSize({ w: dispW, h: dispH });

      // initial crop box: centred, full-width at correct aspect ratio
      const boxW = dispW;
      const boxH = Math.round(boxW / aspectRatio);
      const clampedH = Math.min(boxH, dispH);
      const clampedW = Math.round(clampedH * aspectRatio);
      const initBox: CropBox = {
        x: Math.round((dispW - clampedW) / 2),
        y: Math.round((dispH - clampedH) / 2),
        w: clampedW,
        h: clampedH,
      };
      setCropBox(initBox);
      setReady(true);
    };
    img.src = imageSrc;
  }, [imageSrc, aspectRatio]);

  // ---------- draw ----------
  const draw = useCallback((box: CropBox) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // darken outside crop
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(box.x, box.y, box.w, box.h);
    // redraw original inside crop
    const scaleX = img.naturalWidth / canvas.width;
    const scaleY = img.naturalHeight / canvas.height;
    ctx.drawImage(
      img,
      box.x * scaleX, box.y * scaleY, box.w * scaleX, box.h * scaleY,
      box.x, box.y, box.w, box.h
    );

    // border
    ctx.strokeStyle = '#0EA5E9';
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.w, box.h);

    // rule-of-thirds grid lines
    ctx.strokeStyle = 'rgba(14,165,233,0.4)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(box.x + (box.w / 3) * i, box.y);
      ctx.lineTo(box.x + (box.w / 3) * i, box.y + box.h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(box.x, box.y + (box.h / 3) * i);
      ctx.lineTo(box.x + box.w, box.y + (box.h / 3) * i);
      ctx.stroke();
    }

    // corner handles
    const corners = [
      { cx: box.x, cy: box.y },
      { cx: box.x + box.w, cy: box.y },
      { cx: box.x, cy: box.y + box.h },
      { cx: box.x + box.w, cy: box.y + box.h },
    ];
    ctx.fillStyle = '#0EA5E9';
    corners.forEach(({ cx, cy }) => {
      ctx.fillRect(cx - HANDLE_SIZE / 2, cy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    });
  }, []);

  useEffect(() => {
    if (ready) draw(cropBox);
  }, [ready, cropBox, draw, canvasSize]);

  // ---------- clamp & constrain aspect ratio ----------
  const clamp = (box: CropBox, cw: number, ch: number): CropBox => {
    const minW = Math.max(50, minWidth > 0 ? 1 : 50);
    const minH = Math.round(minW / aspectRatio);
    let { x, y, w, h } = box;
    w = Math.max(minW, w);
    h = Math.round(w / aspectRatio);
    if (h < minH) { h = minH; w = Math.round(h * aspectRatio); }
    if (w > cw) { w = cw; h = Math.round(w / aspectRatio); }
    if (h > ch) { h = ch; w = Math.round(h * aspectRatio); }
    x = Math.max(0, Math.min(x, cw - w));
    y = Math.max(0, Math.min(y, ch - h));
    return { x, y, w, h };
  };

  // ---------- hit test ----------
  const hitTest = (px: number, py: number, box: CropBox) => {
    const hs = HANDLE_SIZE + 4;
    if (Math.abs(px - box.x) < hs && Math.abs(py - box.y) < hs) return 'resize-tl';
    if (Math.abs(px - (box.x + box.w)) < hs && Math.abs(py - box.y) < hs) return 'resize-tr';
    if (Math.abs(px - box.x) < hs && Math.abs(py - (box.y + box.h)) < hs) return 'resize-bl';
    if (Math.abs(px - (box.x + box.w)) < hs && Math.abs(py - (box.y + box.h)) < hs) return 'resize-br';
    if (px > box.x && px < box.x + box.w && py > box.y && py < box.y + box.h) return 'move';
    return null;
  };

  const getPos = (e: React.MouseEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getPos(e);
    const type = hitTest(x, y, cropBox);
    if (!type) return;
    dragState.current = { active: true, type: type as any, startX: x, startY: y, startBox: { ...cropBox } };
    e.preventDefault();
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    const ds = dragState.current;
    if (!ds.active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getPos(e);
    const dx = x - ds.startX;
    const dy = y - ds.startY;
    const sb = ds.startBox;
    let next: CropBox = { ...sb };

    if (ds.type === 'move') {
      next = { ...sb, x: sb.x + dx, y: sb.y + dy };
    } else if (ds.type === 'resize-br') {
      next = { ...sb, w: sb.w + dx, h: sb.h + dy };
    } else if (ds.type === 'resize-bl') {
      next = { x: sb.x + dx, y: sb.y, w: sb.w - dx, h: sb.h + dy };
    } else if (ds.type === 'resize-tr') {
      next = { x: sb.x, y: sb.y + dy, w: sb.w + dx, h: sb.h - dy };
    } else if (ds.type === 'resize-tl') {
      next = { x: sb.x + dx, y: sb.y + dy, w: sb.w - dx, h: sb.h - dy };
    }

    // enforce aspect ratio from width change
    if (ds.type !== 'move') {
      next.h = Math.round(next.w / aspectRatio);
    }

    const clamped = clamp(next, canvas.width, canvas.height);
    setCropBox(clamped);
    draw(clamped);
  }, [aspectRatio, draw]);

  const onMouseUp = useCallback(() => {
    dragState.current.active = false;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // ---------- cursor ----------
  const onMouseMoveCanvas = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || dragState.current.active) return;
    const { x, y } = getPos(e);
    const hit = hitTest(x, y, cropBox);
    if (hit === 'move') canvas.style.cursor = 'move';
    else if (hit?.startsWith('resize')) canvas.style.cursor = 'nwse-resize';
    else canvas.style.cursor = 'default';
  };

  // ---------- confirm crop ----------
  const handleCrop = () => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const scaleX = img.naturalWidth / canvas.width;
    const scaleY = img.naturalHeight / canvas.height;
    const srcX = Math.round(cropBox.x * scaleX);
    const srcY = Math.round(cropBox.y * scaleY);
    const srcW = Math.round(cropBox.w * scaleX);
    const srcH = Math.round(cropBox.h * scaleY);

    // warn if output is below minimum
    if ((minWidth > 0 && srcW < minWidth) || (minHeight > 0 && srcH < minHeight)) {
      setSizeWarning(
        `Cropped area is ${srcW}×${srcH} px, which is below the minimum ${minWidth}×${minHeight} px. ` +
        `Please expand the crop box or upload a higher-resolution image.`
      );
      return;
    }
    setSizeWarning('');

    const out = document.createElement('canvas');
    out.width = srcW;
    out.height = srcH;
    const octx = out.getContext('2d');
    if (!octx) return;
    octx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

    out.toBlob((blob) => {
      if (!blob) return;
      const previewUrl = URL.createObjectURL(blob);
      onCrop(blob, previewUrl);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{label}</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Drag to move · drag corners to resize · aspect ratio is locked</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-950">
          <canvas
            ref={canvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMoveCanvas}
            style={{ display: 'block', maxWidth: '100%' }}
          />
        </div>

        {/* Warning */}
        {sizeWarning && (
          <div className="mx-5 mt-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex-shrink-0">
            {sizeWarning}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleCrop}
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-colors">
            Use this crop
          </button>
        </div>
      </div>
    </div>
  );
}
