import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Minus, Plus, RotateCw, ZoomIn } from 'lucide-react';
import { fetchUploadBlob } from '../lib/api';
import { Dialog, Button, IconButton, Skeleton, cx } from './ui';

export function useUpload(id: string | undefined) {
  return useQuery({ queryKey: ['admin', 'upload', id], queryFn: () => fetchUploadBlob(id!), enabled: !!id, staleTime: 5 * 60_000 });
}

/** Thumbnail of a private document; opens a zoomable viewer. */
export function DocThumb({ uploadId, label, onOpen }: { uploadId?: string; label: string; onOpen: () => void }) {
  const q = useUpload(uploadId);
  if (!uploadId) return <div className="flex aspect-[1.586] w-full items-center justify-center rounded-2xl border border-dashed border-line text-[13px] text-muted">Pièce manquante</div>;
  return (
    <button type="button" onClick={onOpen} className="group relative block w-full overflow-hidden rounded-2xl bg-background" aria-label={`Agrandir : ${label}`} data-testid={`doc-${uploadId}`}>
      {q.isLoading ? <Skeleton className="aspect-[1.586] w-full rounded-none" /> : null}
      {q.isError ? <div className="flex aspect-[1.586] items-center justify-center p-4 text-center text-[13px] text-danger">{(q.error as Error).message}</div> : null}
      {q.data ? (
        q.data.type === 'application/pdf' ? (
          <div className="flex aspect-[1.586] flex-col items-center justify-center gap-2 text-muted"><FileText className="h-8 w-8" />PDF</div>
        ) : (
          <img src={q.data.url} alt={label} className="aspect-[1.586] w-full object-contain" />
        )
      ) : null}
      <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 opacity-0 shadow-card transition group-hover:opacity-100 group-focus-visible:opacity-100">
        <ZoomIn className="h-4 w-4" aria-hidden />
      </span>
    </button>
  );
}

export function DocViewer({ uploadId, label, open, onClose }: { uploadId?: string; label: string; open: boolean; onClose: () => void }) {
  const q = useUpload(open ? uploadId : undefined);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    if (open) {
      setScale(1);
      setRotation(0);
    }
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} size="lg" icon={<FileText />} title={label} description="Document fictif de démonstration · accès journalisé côté serveur." footer={<Button variant="secondary" onClick={onClose}>Fermer</Button>}>
      <div className="mb-3 flex items-center gap-1">
        <IconButton label="Dézoomer" onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}><Minus className="h-4 w-4" /></IconButton>
        <span className="w-14 text-center text-[13px] tabular">{Math.round(scale * 100)} %</span>
        <IconButton label="Zoomer" onClick={() => setScale((s) => Math.min(4, s + 0.25))}><Plus className="h-4 w-4" /></IconButton>
        <IconButton label="Pivoter" onClick={() => setRotation((r) => (r + 90) % 360)}><RotateCw className="h-4 w-4" /></IconButton>
      </div>
      <div className="h-[52vh] overflow-auto rounded-2xl bg-background">
        {q.data ? (
          q.data.type === 'application/pdf' ? (
            <iframe title={label} src={q.data.url} className="h-full w-full" />
          ) : (
            <img src={q.data.url} alt={label} className={cx('origin-top-left transition-transform')} style={{ transform: `scale(${scale}) rotate(${rotation}deg)`, maxWidth: '100%' }} />
          )
        ) : (
          <Skeleton className="h-full w-full" />
        )}
      </div>
    </Dialog>
  );
}
