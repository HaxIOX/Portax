import React from 'react';
import { X } from 'lucide-react';

const SaveMacroModal = ({
  isOpen,
  onClose,
  saveMacroName,
  setSaveMacroName,
  inputText,
  onConfirm,
  theme
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-[320px] ${theme.windowBg} border ${theme.border} rounded-2xl shadow-2xl overflow-hidden`}>
        <div className={`px-5 py-3 border-b ${theme.border} flex items-center justify-between ${theme.panelBg}`}>
          <h3 className={`text-xs font-bold uppercase tracking-widest ${theme.textPrimary}`}>Save Macro</h3>
          <button onClick={onClose} className={theme.textTertiary}>
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={`text-[10px] font-bold uppercase ${theme.textTertiary} mb-1.5 block`}>Name</label>
            <input
              value={saveMacroName}
              onChange={e => setSaveMacroName(e.target.value)}
              autoFocus
              className={`w-full px-3 py-2 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.textPrimary} text-xs outline-none focus:border-neutral-500`}
              placeholder="Enter macro name"
            />
          </div>
          <div>
            <label className={`text-[10px] font-bold uppercase ${theme.textTertiary} mb-1.5 block`}>Command</label>
            <code className={`block w-full px-3 py-2 rounded-lg ${theme.inputBg} border ${theme.border} text-[10px] ${theme.textSecondary} font-mono truncate`}>
              {inputText}
            </code>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className={`flex-1 py-2 rounded-lg border ${theme.border} ${theme.textSecondary} hover:${theme.hoverBg} text-xs font-bold`}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-2 rounded-lg ${theme.accentFill} ${theme.accentText} text-xs font-bold hover:opacity-90`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveMacroModal;
