/**
 * Check if a value is a valid finite number
 * @param {*} v - Value to check
 * @returns {boolean}
 */
export const isValidNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Parse text data for chart visualization
 * Extracts numeric values based on series configuration
 * @param {string} text - Raw text data
 * @param {Array} seriesConfig - Series configuration with keywords
 * @returns {Array} - Array of extracted values (null for missing data)
 */
export const parseDataForChart = (text, seriesConfig) => {
  const extractedValues = new Array(seriesConfig.length).fill(null);
  let foundKeyword = false;

  // Try keyword-based extraction first
  seriesConfig.forEach((conf, idx) => {
    if (!conf.visible) {
      extractedValues[idx] = null;
      return;
    }

    if (conf.keyword && conf.keyword.trim() !== '') {
      const escapedKey = conf.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`${escapedKey}\\s*[:=-]?\\s*(-?\\d+(\\.\\d+)?)`, 'i');
      const match = text.match(regex);

      if (match) {
        extractedValues[idx] = parseFloat(match[1]);
        foundKeyword = true;
      } else {
        extractedValues[idx] = null;
      }
    }
  });

  // If no keywords configured or found, try to extract all numbers
  const hasAnyKeywords = seriesConfig.some(s => s.keyword && s.keyword.trim() !== '');

  if (!hasAnyKeywords && !foundKeyword) {
    const allNumbers = text.match(/-?\d+(\.\d+)?/g);

    if (allNumbers) {
      const nums = allNumbers.map(Number);
      seriesConfig.forEach((conf, idx) => {
        if (idx < nums.length) {
          extractedValues[idx] = conf.visible ? nums[idx] : null;
        } else {
          extractedValues[idx] = null;
        }
      });
      return extractedValues;
    }
  }

  // Return empty array if no valid data found
  if (!extractedValues.some(isValidNumber)) return [];

  return extractedValues;
};
