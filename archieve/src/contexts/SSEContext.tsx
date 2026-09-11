"use client";

import { createContext, useContext, useEffect, useRef, useCallback, useState, ReactNode, useMemo } from 'react';

interface FetchCompleteEvent {
  feedId: string;
  lastFetchedAt: string | null;
  totalArticles: number | null;
}

interface LogLine {
  timestamp: string;
  level: string;
  status?: number;
  action: string;
  url: string;
  duration?: string;
  message?: string;
  feedTitle?: string;
}

interface SSEContextType {
  onFetchComplete: (callback: (event: FetchCompleteEvent) => void) => () => void;
  onLogsInit: (callback: (data: { logs: LogLine[] }) => void) => () => void;
  onLogsUpdate: (callback: (data: { logs: LogLine[] }) => void) => () => void;
  isOnline: boolean;
}

const SSEContext = createContext<SSEContextType | undefined>(undefined);

export function SSEProvider({ children }: { children: ReactNode }) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const fetchListenersRef = useRef<Set<(event: FetchCompleteEvent) => void>>(new Set());
  const logsInitListenersRef = useRef<Set<(data: { logs: LogLine[] }) => void>>(new Set());
  const logsUpdateListenersRef = useRef<Set<(data: { logs: LogLine[] }) => void>>(new Set());
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Create single SSE connection for the entire app
    const eventSource = new EventSource('/api/logs/stream');
    eventSourceRef.current = eventSource;

    // Handle fetch-complete events
    eventSource.addEventListener('fetch-complete', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as FetchCompleteEvent;
        fetchListenersRef.current.forEach(callback => callback(data));
      } catch (error) {
        console.error('Failed to parse fetch-complete event:', error);
      }
    });

    // Handle logs init events
    eventSource.addEventListener('init', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setIsOnline(true);
        logsInitListenersRef.current.forEach(callback => callback(data));
      } catch (error) {
        console.error('Failed to parse init event:', error);
      }
    });

    // Handle logs update events
    eventSource.addEventListener('update', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setIsOnline(true);
        logsUpdateListenersRef.current.forEach(callback => callback(data));
      } catch (error) {
        console.error('Failed to parse update event:', error);
      }
    });

    // Handle system events
    eventSource.addEventListener('system', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        console.log('System:', data.message);
        setIsOnline(true);
      } catch (error) {
        console.error('Failed to parse system event:', error);
      }
    });

    // Handle connection errors
    eventSource.onerror = () => {
      setIsOnline(false);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, []);

  const onFetchComplete = useCallback((callback: (event: FetchCompleteEvent) => void) => {
    fetchListenersRef.current.add(callback);
    return () => fetchListenersRef.current.delete(callback);
  }, []);

  const onLogsInit = useCallback((callback: (data: { logs: LogLine[] }) => void) => {
    logsInitListenersRef.current.add(callback);
    return () => logsInitListenersRef.current.delete(callback);
  }, []);

  const onLogsUpdate = useCallback((callback: (data: { logs: LogLine[] }) => void) => {
    logsUpdateListenersRef.current.add(callback);
    return () => logsUpdateListenersRef.current.delete(callback);
  }, []);

  const value = useMemo(() => ({
    onFetchComplete,
    onLogsInit,
    onLogsUpdate,
    isOnline
  }), [onFetchComplete, onLogsInit, onLogsUpdate, isOnline]);

  return (
    <SSEContext.Provider value={value}>
      {children}
    </SSEContext.Provider>
  );
}

export function useSSE() {
  const context = useContext(SSEContext);
  if (!context) {
    throw new Error('useSSE must be used within SSEProvider');
  }
  return context;
}

/**
 * Hook for listening to feed fetch completion events.
 * Uses the global SSE connection to avoid multiple connections.
 */
export function useFeedFetchEvents(options: { onFetchComplete?: (event: FetchCompleteEvent) => void } = {}) {
  const { onFetchComplete } = useSSE();
  const { onFetchComplete: parentCallback } = options;

  useEffect(() => {
    if (!parentCallback) return;

    const unsubscribe = onFetchComplete(parentCallback);
    return unsubscribe;
  }, [onFetchComplete, parentCallback]);
}

/**
 * Hook for listening to log events.
 * Uses the global SSE connection to avoid multiple connections.
 */
export function useLogsEvents(options: {
  onInit?: (data: { logs: LogLine[] }) => void;
  onUpdate?: (data: { logs: LogLine[] }) => void;
} = {}) {
  const { onLogsInit, onLogsUpdate } = useSSE();
  const { onInit, onUpdate } = options;

  useEffect(() => {
    if (!onInit) return;

    const unsubscribe = onLogsInit(onInit);
    return unsubscribe;
  }, [onLogsInit, onInit]);

  useEffect(() => {
    if (!onUpdate) return;

    const unsubscribe = onLogsUpdate(onUpdate);
    return unsubscribe;
  }, [onLogsUpdate, onUpdate]);
}
