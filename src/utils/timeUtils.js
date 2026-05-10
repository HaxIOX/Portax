/**
 * Get current timestamp in HH:MM:SS.mmm format
 * @returns {string} - Formatted timestamp
 */
export const getTimestamp = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
};
