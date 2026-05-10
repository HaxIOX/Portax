import React from 'react';
import { X, Usb } from 'lucide-react';

const ConnectModal = ({
  isOpen,
  onClose,
  isWebSerialSupported,
  isSerialAllowed,
  availablePorts,
  onOpenPort,
  onScanDevices,
  theme
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-[420px] ${theme.windowBg} border ${theme.border} rounded-3xl shadow-2xl p-8`}>
        <div className="flex items-center justify-between mb-8">
          <h3 className={`text-sm font-bold uppercase tracking-widest ${theme.textPrimary}`}>
            Hardware Connection
          </h3>
          <button onClick={onClose} className={theme.textTertiary}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-2 mb-8 max-h-[240px] overflow-y-auto custom-scrollbar">
          {!isWebSerialSupported ? (
            <div className="text-center py-8 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <div className="text-rose-500 font-bold text-xs mb-1">BROWSER NOT SUPPORTED</div>
            </div>
          ) : !isSerialAllowed ? (
            <div className="text-center py-8 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <div className="text-amber-500 font-bold text-xs mb-1">PERMISSION BLOCKED</div>
            </div>
          ) : availablePorts.length === 0 ? (
            <div className={`text-center py-10 border-2 border-dashed ${theme.border} rounded-2xl opacity-60`}>
              <div className={`text-xs ${theme.textTertiary} font-bold`}>NO GRANTED DEVICES</div>
              <div className={`text-[10px] ${theme.textTertiary} mt-2`}>Click SCAN below to authorize a device</div>
            </div>
          ) : (
            availablePorts.map((p, i) => (
              <button
                key={i}
                onClick={() => onOpenPort(p)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border ${theme.border} ${theme.hoverBg} text-left group transition-all`}
              >
                <div className={`size-10 rounded-full flex items-center justify-center ${theme.inputBg} border ${theme.border} group-hover:border-neutral-500/50 transition-colors`}>
                  <Usb size={18} className={theme.textPrimary} />
                </div>
                <div>
                  <div className={`text-xs font-bold ${theme.textPrimary}`}>PORT {i + 1}</div>
                  <div className={`text-[10px] font-mono ${theme.textTertiary}`}>
                    ID: {p.getInfo().usbVendorId?.toString(16)}:{p.getInfo().usbProductId?.toString(16)}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <button
          onClick={onScanDevices}
          disabled={!isWebSerialSupported || !isSerialAllowed}
          className={`w-full py-3.5 ${theme.accentFill} ${theme.accentText} ${theme.accentHover} rounded-xl text-xs font-bold tracking-widest uppercase hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md`}
        >
          SCAN FOR DEVICES
        </button>
      </div>
    </div>
  );
};

export default ConnectModal;
