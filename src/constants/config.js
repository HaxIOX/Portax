// Serial Communication Constants
export const COMMON_BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

export const DEFAULT_BAUD_RATE = 115200;
export const DEFAULT_ENCODING = 'utf-8';
export const DEFAULT_LINE_ENDING = '\\n';

// RX Data Processing
export const RX_LINE_SPLIT_RE = /\r\n|\n|\r|\\r\\n|\\r|\\n/;
export const RX_IDLE_FLUSH_MS = 150;
export const RX_MAX_LINE_LENGTH = 4096;
export const RX_HINTS_ENABLED = true;

// Waveform Chart
export const SERIES_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899'];
export const MAX_PLOT_DATA_POINTS = 150;

// Highlight Presets
export const HIGHLIGHT_PRESETS = [
  'bg-[#ecf0f1] text-black border-[#ecf0f1]',
  'bg-[#e74c3c] text-white border-[#e74c3c]',
  'bg-[#1abc9c] text-white border-[#1abc9c]',
  'bg-[#f4d03f] text-black border-[#f4d03f]',
  'bg-[#3b82f6] text-white border-[#3b82f6]'
];

export const DEFAULT_HIGHLIGHT_COLOR = 'bg-[#f4d03f] text-black border-[#f4d03f]';

// Default Quick Commands
export const DEFAULT_QUICK_COMMANDS = [
  { id: 1, label: 'STATUS', cmd: 'AT+STATUS?' },
  { id: 2, label: 'RESET', cmd: 'AT+RST' },
  { id: 3, label: 'VERSION', cmd: 'AT+GMR' },
  { id: 4, label: 'WIFI', cmd: 'AT+CWMODE=1' },
];

// Default Series Configuration
export const DEFAULT_SERIES_CONFIG = [
  { id: 0, name: 'Current', keyword: '', visible: true },
  { id: 1, name: 'Voltage', keyword: '', visible: true },
  { id: 2, name: 'Power', keyword: '', visible: false },
  { id: 3, name: 'Temp', keyword: '', visible: false },
];

// Timer
export const DEFAULT_TIMER_INTERVAL = 1000;

// History
export const MAX_SEND_HISTORY = 50;

// LocalStorage Keys
export const STORAGE_KEYS = {
  BAUD_RATE: 'sf_baud',
  ENCODING: 'sf_enc',
  HIGHLIGHT_KEYWORD: 'sf_hl_kw',
  HIGHLIGHT_COLOR: 'sf_hl_col',
  QUICK_COMMANDS: 'sf_cmds',
  USE_HEX_SEND: 'sf_hex_send',
  LINE_ENDING: 'sf_eol',
  APPEND_CRC: 'sf_crc',
  SHOW_TIMESTAMP: 'sf_show_ts',
  THEME: 'sf_theme',
  TIMER_INTERVAL: 'sf_timer_ms',
  SEND_HISTORY: 'sf_history',
  PLOT_SCALE_MODE: 'sf_plot_scale',
};

// Storage Version
export const STORAGE_VERSION = '_v4';
