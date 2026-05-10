import React from 'react';
import { X, Send, Edit2, ArrowUp, Trash, Check } from 'lucide-react';

const MacroManagerModal = ({
  isOpen,
  onClose,
  quickCommands,
  editingId,
  editLabel,
  setEditLabel,
  editCmdStr,
  setEditCmdStr,
  onSaveEdit,
  onStartEditing,
  onSendCommand,
  onMoveToTop,
  onDelete,
  theme
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-[500px] h-[600px] ${theme.windowBg} border ${theme.border} rounded-3xl shadow-2xl flex flex-col overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${theme.border} flex items-center justify-between ${theme.panelBg}`}>
          <h3 className={`text-sm font-bold uppercase tracking-widest ${theme.textPrimary}`}>Macro Manager</h3>
          <button onClick={onClose} className={theme.textTertiary}>
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
          {quickCommands.map((cmd, index) => (
            <div key={cmd.id} className={`flex items-center gap-3 p-3 rounded-xl border ${theme.border} ${theme.inputBg}`}>
              <div className="flex flex-col flex-1 min-w-0">
                {editingId === cmd.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      className={`px-2 py-1 rounded border ${theme.border} ${theme.inputBg} ${theme.textPrimary} text-xs outline-none focus:border-neutral-500`}
                      placeholder="Label"
                    />
                    <input
                      value={editCmdStr}
                      onChange={e => setEditCmdStr(e.target.value)}
                      className={`px-2 py-1 rounded border ${theme.border} ${theme.inputBg} ${theme.textPrimary} text-xs outline-none focus:border-neutral-500 font-mono`}
                      placeholder="Command"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      {index < 3 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold uppercase">
                          Fixed
                        </span>
                      )}
                      <span className={`text-xs font-bold ${theme.textPrimary}`}>{cmd.label}</span>
                    </div>
                    <code className={`text-[10px] ${theme.textTertiary} truncate`}>{cmd.cmd}</code>
                  </>
                )}
              </div>
              {editingId === cmd.id ? (
                <>
                  <button
                    onClick={onSaveEdit}
                    className={`p-2 rounded-lg ${theme.accentFill} ${theme.accentText} hover:opacity-90`}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => onStartEditing(null)}
                    className={`p-2 rounded-lg border ${theme.border} ${theme.hoverBg} ${theme.textSecondary}`}
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onSendCommand(cmd.cmd)}
                    className={`p-2 rounded-lg ${theme.accentFill} ${theme.accentText} hover:opacity-90`}
                  >
                    <Send size={14} />
                  </button>
                  <button
                    onClick={() => onStartEditing(cmd)}
                    className={`p-2 rounded-lg border ${theme.border} ${theme.hoverBg} ${theme.textSecondary}`}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => onMoveToTop(index)}
                    disabled={index === 0}
                    className={`p-2 rounded-lg border ${theme.border} ${theme.hoverBg} ${theme.textSecondary} disabled:opacity-30`}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => onDelete(cmd.id)}
                    className={`p-2 rounded-lg border ${theme.border} hover:bg-rose-400/10 text-rose-400`}
                  >
                    <Trash size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MacroManagerModal;
