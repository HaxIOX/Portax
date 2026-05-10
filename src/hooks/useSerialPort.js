import { useState, useRef, useCallback, useEffect } from 'react';
import { logger } from '../utils/logger';
import { getTimestamp } from '../utils/timeUtils';

/**
 * Custom hook for managing Web Serial API connections
 * Handles port connection, disconnection, reading, and writing
 */
export const useSerialPort = ({
  baudRate,
  encoding,
  onDataReceived,
  onConnectionChange
}) => {
  const [port, setPort] = useState(null);
  const [availablePorts, setAvailablePorts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSerialAllowed, setIsSerialAllowed] = useState(true);

  const portRef = useRef(null);
  const readerRef = useRef(null);
  const readableStreamClosedRef = useRef(null);
  const closingRef = useRef(false);

  const isWebSerialSupported = 'serial' in navigator;

  // Update ports list
  const updatePorts = useCallback(async () => {
    if (!isWebSerialSupported) return;
    try {
      const ports = await navigator.serial.getPorts();
      setAvailablePorts(ports);
      setIsSerialAllowed(true);
    } catch (e) {
      setIsSerialAllowed(false);
    }
  }, [isWebSerialSupported]);

  // Disconnect port
  const disconnectPort = useCallback(async () => {
    closingRef.current = true;

    const reader = readerRef.current;
    readerRef.current = null;
    const closed = readableStreamClosedRef.current;
    readableStreamClosedRef.current = null;
    const currentPort = portRef.current;

    try {
      if (reader) await reader.cancel();
    } catch {}
    try {
      if (reader) reader.releaseLock();
    } catch {}
    try {
      if (closed) await closed.catch(() => {});
    } catch {}
    try {
      if (currentPort) await currentPort.close();
    } catch (e) {
      logger.error(e);
    }

    setPort(null);
    portRef.current = null;
    setIsConnected(false);
    closingRef.current = false;

    if (onConnectionChange) {
      onConnectionChange(false);
    }

    updatePorts();
  }, [updatePorts, onConnectionChange]);

  // Read loop
  const readLoop = useCallback(async (selectedPort) => {
    logger.debug('readLoop started, encoding:', encoding);
    const textDecoder = new TextDecoderStream(encoding);
    const readableStreamClosed = selectedPort.readable.pipeTo(textDecoder.writable);
    readableStreamClosedRef.current = readableStreamClosed;
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          logger.debug('reader.read() done');
          break;
        }
        if (value && onDataReceived) {
          logger.debug('Received data:', value.length, 'chars, preview:', value.substring(0, 50));
          onDataReceived(value);
        }
      }
    } catch (error) {
      if (!closingRef.current) logger.error("Read Error: ", error);
    } finally {
      logger.debug('readLoop ended');
      try {
        reader.releaseLock();
      } catch {}
      if (readerRef.current === reader) readerRef.current = null;
      try {
        await readableStreamClosed;
      } catch {}
      if (readableStreamClosedRef.current === readableStreamClosed) {
        readableStreamClosedRef.current = null;
      }
    }
  }, [encoding, onDataReceived]);

  // Open port
  const openPort = useCallback(async (selectedPort) => {
    logger.debug('openPort called, baudRate:', baudRate);
    try {
      await selectedPort.open({ baudRate: parseInt(baudRate) || 115200 });
      logger.debug('Port opened successfully');
      setPort(selectedPort);
      portRef.current = selectedPort;
      setIsConnected(true);
      closingRef.current = false;

      if (onConnectionChange) {
        onConnectionChange(true);
      }

      readLoop(selectedPort);
    } catch (error) {
      logger.error('Port open failed:', error);
      throw error;
    }
  }, [baudRate, readLoop, onConnectionChange]);

  // Write data to port
  const writeData = useCallback(async (data) => {
    if (!port?.writable) {
      throw new Error('Port not writable');
    }

    const writer = port.writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }, [port]);

  // Request new port
  const requestPort = useCallback(async () => {
    if (!isWebSerialSupported || !isSerialAllowed) {
      throw new Error('Serial API not supported or not allowed');
    }

    try {
      const selectedPort = await navigator.serial.requestPort();
      await openPort(selectedPort);
      await updatePorts();
      return selectedPort;
    } catch (error) {
      logger.error('Port request failed:', error);
      throw error;
    }
  }, [isWebSerialSupported, isSerialAllowed, openPort, updatePorts]);

  // Listen for port connect/disconnect events
  useEffect(() => {
    if (!isWebSerialSupported) return;

    const handleConnect = () => {
      updatePorts();
    };

    const handleDisconnect = (e) => {
      updatePorts();
      if (portRef.current === e.target) {
        disconnectPort();
      }
    };

    updatePorts();
    navigator.serial.addEventListener('connect', handleConnect);
    navigator.serial.addEventListener('disconnect', handleDisconnect);

    return () => {
      navigator.serial.removeEventListener('connect', handleConnect);
      navigator.serial.removeEventListener('disconnect', handleDisconnect);
    };
  }, [isWebSerialSupported, updatePorts, disconnectPort]);

  return {
    // State
    port,
    availablePorts,
    isConnected,
    isSerialAllowed,
    isWebSerialSupported,

    // Methods
    openPort,
    disconnectPort,
    writeData,
    requestPort,
    updatePorts,
  };
};
