import { useState, useEffect } from 'react';
import { STORAGE_VERSION } from '../constants/config';

/**
 * Custom hook for persisting state to localStorage with versioning
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if no stored value exists
 * @param {number} debounceMs - Optional debounce delay for writes (default: 0)
 * @returns {[*, Function]} - [state, setState]
 */
export const usePersistedState = (key, defaultValue, debounceMs = 0) => {
  const [state, setState] = useState(() => {
    try {
      const item = localStorage.getItem(key + STORAGE_VERSION);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Failed to load persisted state for key "${key}":`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    if (debounceMs > 0) {
      const timeoutId = setTimeout(() => {
        try {
          localStorage.setItem(key + STORAGE_VERSION, JSON.stringify(state));
        } catch (error) {
          console.error(`Failed to persist state for key "${key}":`, error);
        }
      }, debounceMs);

      return () => clearTimeout(timeoutId);
    } else {
      try {
        localStorage.setItem(key + STORAGE_VERSION, JSON.stringify(state));
      } catch (error) {
        console.error(`Failed to persist state for key "${key}":`, error);
      }
    }
  }, [key, state, debounceMs]);

  return [state, setState];
};
