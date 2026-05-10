import React from 'react';
import { X, Camera, FileDown, Trash, ExternalLink, FileText } from 'lucide-react';

const SnapshotGalleryModal = ({
  isOpen,
  onClose,
  snapshots,
  onDeleteSnapshot,
  onClearAll,
  onViewReport,
  onExportPdf,
  theme
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-[90vw] max-w-[1000px] h-[80vh] ${theme.windowBg} border ${theme.border} rounded-3xl shadow-2xl flex flex-col overflow-hidden`}>
        {/* Fixed Header Layout */}
        <div className={`px-8 pt-10 pb-4 border-b ${theme.border} flex items-center justify-between ${theme.panelBg}`}>
          <div className="flex items-center gap-3">
            <h3 className={`text-sm font-bold uppercase tracking-widest ${theme.textPrimary}`}>Snapshot Gallery</h3>
            <span className={`px-2 py-0.5 rounded-full ${theme.inputBg} border ${theme.border} text-[10px] ${theme.textSecondary}`}>
              {snapshots.length} items
            </span>
          </div>
          <button onClick={onClose} className={theme.textTertiary}>
            <X size={20} />
          </button>
        </div>

        {/* Fixed Grid Layout */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 grid grid-cols-2 md:grid-cols-3 gap-6 content-start">
          {snapshots.map(s => (
            <div key={s.id} className={`group relative rounded-2xl border ${theme.border} overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-black/5`}>
              <div className="aspect-video relative overflow-hidden bg-white/5">
                <img src={s.url} alt="Snapshot" className="w-full h-full object-contain" />
              </div>
              <div className={`px-4 py-3 border-t ${theme.border} ${theme.panelBg} flex items-center justify-between`}>
                <div className="flex flex-col">
                  <span className={`text-[10px] font-bold ${theme.textPrimary}`}>
                    Snapshot #{s.id.toString().slice(-4)}
                  </span>
                  <span className={`text-[9px] ${theme.textTertiary}`}>{s.meta.timestamp}</span>
                </div>
                <div className="flex gap-2">
                  <a
                    href={s.url}
                    download={`snapshot-${s.id}.png`}
                    className={`p-2 rounded-lg border ${theme.border} hover:${theme.hoverBg} ${theme.textPrimary}`}
                    title="Download Image"
                  >
                    <FileDown size={14} />
                  </a>
                  <button
                    onClick={() => onDeleteSnapshot(s.id)}
                    className={`p-2 rounded-lg border ${theme.border} hover:bg-rose-500/10 text-rose-500`}
                    title="Delete"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {snapshots.length === 0 && (
            <div className={`col-span-1 md:col-span-3 py-20 text-center ${theme.textTertiary} text-sm flex flex-col items-center gap-3 opacity-50`}>
              <Camera size={48} strokeWidth={1} />
              <span>Gallery is empty. Capture snapshots from the monitor view.</span>
            </div>
          )}
        </div>

        <div className={`px-8 py-4 border-t ${theme.border} ${theme.panelBg} flex justify-end gap-3`}>
          <button
            onClick={onClearAll}
            className="px-5 py-2.5 text-xs text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors font-medium"
          >
            Clear Gallery
          </button>
          <button
            onClick={onViewReport}
            className={`px-6 py-2.5 rounded-xl border ${theme.border} ${theme.textSecondary} hover:${theme.textPrimary} hover:${theme.hoverBg} text-xs font-bold flex items-center gap-2 transition-all`}
          >
            <ExternalLink size={14} /> View HTML
          </button>
          <button
            onClick={onExportPdf}
            disabled={snapshots.length === 0}
            className={`px-6 py-2.5 ${theme.accentFill} ${theme.accentText} text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all`}
          >
            <FileText size={14} /> Export PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default SnapshotGalleryModal;
