import React from 'react';
import { Plug, ChevronDown, Cpu, Timer, BookmarkPlus, List, Send } from 'lucide-react';
import { COMMON_BAUD_RATES, HIGHLIGHT_PRESETS } from '../constants/config';

const Sidebar = ({
  isConnected,
  baudRate,
  setBaudRate,
  isBaudDropdownOpen,
  setIsBaudDropdownOpen,
  onConnect,
  onDisconnect,
  highlightKeyword,
  setHighlightKeyword,
  highlightColor,
  setHighlightColor,
  quickCommands,
  onSendCommand,
  timerEnabled,
  setTimerEnabled,
  timerInterval,
  setTimerInterval,
  useHexSend,
  setUseHexSend,
  appendCRC,
  setAppendCRC,
  lineEnding,
  cycleLineEnding,
  getLineEndingLabel,
  inputText,
  setInputText,
  onSendData,
  onSaveToMacro,
  onOpenMacroManager,
  handleKeyDown,
  theme,
  baudRef
}) => {
  return (
    <aside className={`w-[260px] border-l ${theme.border} flex flex-col z-20 ${theme.panelBg}`}>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
        {/* Connection Section */}
        <div className="space-y-3">
          <h3 className={`text-[11px] font-bold uppercase tracking-widest ${theme.textTertiary} flex items-center gap-2 px-1`}>
            <Plug size={12} /> Connection
          </h3>
          <div className="flex flex-col gap-3">
            <div className={`relative border ${theme.border} rounded-2xl ${theme.inputBg} transition-colors hover:${theme.borderHover}`} ref={baudRef}>
              <button
                onClick={() => !isConnected && setIsBaudDropdownOpen(!isBaudDropdownOpen)}
                disabled={isConnected}
                className={`w-full h-11 flex items-center justify-between px-4 text-xs font-mono font-medium ${isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span>{baudRate} BAUD</span>
                <ChevronDown size={14} className={theme.textTertiary} />
              </button>
              {isBaudDropdownOpen && !isConnected && (
                <div className={`absolute top-full left-0 right-0 mt-2 z-50 border ${theme.border} ${theme.windowBg} shadow-2xl rounded-xl max-h-48 overflow-y-auto custom-scrollbar p-1`}>
                  {COMMON_BAUD_RATES.map(r => (
                    <button
                      key={r}
                      onClick={() => { setBaudRate(r); setIsBaudDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-mono rounded-lg hover:${theme.hoverBg} transition-colors`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={isConnected ? onDisconnect : onConnect}
              className={`w-full h-11 rounded-2xl text-xs font-bold tracking-wide border transition-all active:scale-[0.98] ${
                isConnected
                  ? `border-neutral-500/20 text-neutral-500 hover:bg-neutral-500/10`
                  : `${theme.accentFill} ${theme.accentText} border-transparent shadow-md hover:opacity-90`
              }`}
            >
              {isConnected ? 'DISCONNECT' : 'CONNECT DEVICE'}
            </button>
          </div>
        </div>

        <div className={`h-px w-full ${theme.border}`}></div>

        {/* Highlight Section */}
        <div className="space-y-2">
          <h3 className={`text-[11px] font-bold uppercase tracking-widest ${theme.textTertiary} px-1`}>Highlight</h3>
          <div className="flex flex-col gap-2">
            <input
              value={highlightKeyword}
              onChange={e => setHighlightKeyword(e.target.value)}
              placeholder="Keyword..."
              className={`w-full px-3 py-1.5 rounded-lg border ${theme.border} ${theme.inputBg} ${theme.textPrimary} text-xs focus:border-neutral-500 outline-none placeholder:${theme.textTertiary} transition-colors`}
            />
            <div className="flex gap-2">
              {HIGHLIGHT_PRESETS.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setHighlightColor(c)}
                  className={`h-7 flex-1 rounded-lg border text-[10px] font-bold transition-transform hover:scale-105 ${c.split(' ')[0]} ${c.split(' ')[1]} ${c.split(' ')[2]}`}
                ></button>
              ))}
            </div>
          </div>
        </div>

        <div className={`h-px w-full ${theme.border}`}></div>

        {/* Quick Commands Section */}
        <div className="space-y-3 flex-1">
          <div className="flex items-center justify-between px-1">
            <h3 className={`text-[11px] font-bold uppercase tracking-widest ${theme.textTertiary} flex items-center gap-2`}>
              <Cpu size={12} /> Fixed Cmds
            </h3>
          </div>
          <div className="space-y-3">
            {quickCommands.slice(0, 3).map(cmd => (
              <button
                key={cmd.id}
                onClick={() => onSendCommand(cmd.cmd)}
                disabled={!isConnected}
                className={`w-full group flex items-center justify-between p-3.5 rounded-2xl border ${theme.border} ${theme.inputBg} hover:border-neutral-500/30 transition-all disabled:opacity-50 text-left shadow-sm active:scale-[0.98] overflow-hidden`}
              >
                <span className={`text-[11px] font-bold ${theme.textPrimary} shrink-0`}>{cmd.label}</span>
                <span className={`text-[10px] font-mono ${theme.textTertiary} group-hover:${theme.textSecondary} transition-colors truncate ml-2`}>
                  {cmd.cmd}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Input Area */}
      <div className={`p-4 border-t ${theme.border} bg-transparent flex flex-col gap-3 relative`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setTimerEnabled(!timerEnabled)}
              className={`size-6 flex items-center justify-center rounded-md border ${theme.border} ${
                timerEnabled ? 'text-amber-500 border-amber-500 bg-amber-500/10' : theme.textTertiary
              } hover:${theme.textPrimary} transition-colors`}
            >
              <Timer size={12} />
            </button>
            <input
              type="number"
              value={timerInterval}
              onChange={e => setTimerInterval(e.target.value)}
              className={`w-10 bg-transparent text-[10px] font-mono outline-none text-center ${theme.textPrimary} border-b border-dashed border-neutral-500/30`}
            />
            <span className={`text-[9px] ${theme.textTertiary}`}>ms</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setUseHexSend(!useHexSend)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                useHexSend ? `${theme.accentFill} ${theme.accentText} border-transparent` : `${theme.border} ${theme.textTertiary} hover:${theme.textSecondary}`
              }`}
            >
              HEX
            </button>
            <button
              onClick={() => setAppendCRC(!appendCRC)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                appendCRC ? `${theme.accentFill} ${theme.accentText} border-transparent` : `${theme.border} ${theme.textTertiary} hover:${theme.textSecondary}`
              }`}
            >
              CRC
            </button>
            <button
              onClick={cycleLineEnding}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border transition-colors ${
                lineEnding !== '' ? `${theme.accentFill} ${theme.accentText} border-transparent` : `${theme.border} ${theme.textTertiary} hover:${theme.textSecondary}`
              }`}
            >
              {getLineEndingLabel()}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSaveToMacro}
            className={`flex-1 py-1.5 rounded-md border ${theme.border} ${theme.textTertiary} hover:${theme.textPrimary} hover:${theme.hoverBg} transition-colors text-[10px] font-bold flex items-center justify-center gap-1.5`}
            title="Save as Macro"
          >
            <BookmarkPlus size={12} /> <span className="uppercase tracking-wider">Save</span>
          </button>
          <button
            onClick={onOpenMacroManager}
            className={`flex-1 py-1.5 rounded-md border ${theme.border} ${theme.textTertiary} hover:${theme.textPrimary} hover:${theme.hoverBg} transition-colors text-[10px] font-bold flex items-center justify-center gap-1.5`}
            title="Manage Macros"
          >
            <List size={12} /> <span className="uppercase tracking-wider">Macros</span>
          </button>
        </div>
        <textarea
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`w-full h-20 p-3 rounded-xl border ${theme.border} ${theme.inputBg} ${theme.textPrimary} text-xs font-mono outline-none focus:border-neutral-500 transition-all resize-none placeholder:${theme.textTertiary} shadow-sm group-hover:${theme.borderHover}`}
          placeholder="Type command..."
        />
        <button
          onClick={onSendData}
          disabled={!isConnected}
          className={`w-full py-2.5 rounded-xl ${theme.accentFill} ${theme.accentText} ${theme.accentHover} text-[11px] font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2`}
        >
          <Send size={14} /> SEND COMMAND
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
