/**
 * Calculate CRC16 Modbus checksum for a buffer
 * @param {Uint8Array} buffer - The data buffer to calculate CRC for
 * @returns {Uint8Array} - 2-byte CRC16 value [low byte, high byte]
 */
export const calculateCRC16 = (buffer) => {
  let crc = 0xFFFF;
  for (let pos = 0; pos < buffer.length; pos++) {
    crc ^= buffer[pos];
    for (let i = 8; i !== 0; i--) {
      if ((crc & 0x0001) !== 0) {
        crc >>= 1;
        crc ^= 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return new Uint8Array([crc & 0xFF, (crc >> 8) & 0xFF]);
};

/**
 * Parse a hex string into a Uint8Array
 * @param {string} str - Hex string (e.g., "01 02 FF" or "0102FF")
 * @returns {Uint8Array|null} - Parsed byte array, or null if invalid
 */
export const parseHexString = (str) => {
  const cleanStr = str.replace(/[^0-9a-fA-F]/g, '');
  if (!cleanStr || cleanStr.length % 2 !== 0) return null;
  const byteArray = new Uint8Array(cleanStr.length / 2);
  for (let i = 0; i < cleanStr.length; i += 2) {
    byteArray[i / 2] = parseInt(cleanStr.substring(i, i + 2), 16);
  }
  return byteArray;
};

/**
 * Convert a buffer to hex string representation
 * @param {ArrayBuffer|Uint8Array} buffer - Buffer to convert
 * @returns {string} - Hex string with spaces (e.g., "01 02 FF")
 */
export const bufferToHex = (buffer) => {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
};
