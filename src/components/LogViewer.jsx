import React, { memo } from 'react';
import { Terminal } from 'lucide-react';

const LogEntry = memo(({ log, showTimestamp, isDark, textTheme, renderContent, onCopy }) => {
  const isTx = log.type === 'tx';
  const isSys = log.type === 'sys';

  const badgeClass = isTx
    ? (isDark ? 'text-blue-400 border-blue-400/50' : 'text-blue-600 border-blue-600/30')
    : isSys
      ? (isDark ? 'text-amber-400 border-amber-400/50' : 'text-amber-600 border-amber-600/30')
      : (isDark ? 'text-emerald-400 border-emerald-400/50' : 'text-emerald-600 border-emerald-600/30');

  const textClass = isTx
    ? (isDark ? 'text-blue-400' : 'text-blue-600')
    : isSys
      ? (isDark ? 'text-amber-400' : 'text-amber-600')
      : (isDark ? 'text-emerald-400' : 'text-emerald-600');

  const label = isTx ? 'TX' : isSys ? 'SYS' : 'RX';

  return (
    <div
      onClick={() => onCopy(String(log.text))}
      className={`flex gap-3 px-3 py-1 items-start rounded-lg cursor-pointer hover:${textTheme.hoverBg} group transition-colors`}
    >
      {showTimestamp && (
        <span className={`shrink-0 text-xs ${textTheme.textTertiary} select-none font-medium opacity-60 pt-[2px]`}>
          {log.timestamp}
        </span>
      )}
      <span className={`shrink-0 text-xs font-bold w-10 text-center select-none rounded border px-0.5 pt-0.5 mt-[1px] ${badgeClass}`}>
        {label}
      </span>
      <span className={`break-all whitespace-pre-wrap min-w-0 ${textClass} opacity-90`}>
        {renderContent(log.text)}
      </span>
    </div>
  );
});

LogEntry.displayName = 'LogEntry';

const LogViewer = ({
  logs,
  logFilter,
  showTimestamp,
  isDark,
  textTheme,
  renderContent,
  isWebSerialSupported
}) => {
  const filteredLogs = logs.filter(
    l => !logFilter || String(l.text).toLowerCase().includes(logFilter.toLowerCase())
  );

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  if (logs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center select-none opacity-30">
        <Terminal size={64} className="text-emerald-500" strokeWidth={1.5} />
        <span className="mt-4 text-xs font-bold uppercase tracking-widest text-emerald-500/80">
          Ready to Receive
        </span>
        {!isWebSerialSupported && (
          <div className="mt-2 text-rose-500 text-xs">Browser Not Supported</div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {filteredLogs.map((log) => (
        <LogEntry
          key={log.id}
          log={log}
          showTimestamp={showTimestamp}
          isDark={isDark}
          textTheme={textTheme}
          renderContent={renderContent}
          onCopy={handleCopy}
        />
      ))}
    </div>
  );
};

export default memo(LogViewer);
