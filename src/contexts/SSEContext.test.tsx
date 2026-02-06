import { describe, test, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { renderHook, act, waitFor } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import React from 'react';

class MockEventSource {
  static instances: MockEventSource[] = [];
  
  url: string;
  listeners: Map<string, Set<(e: MessageEvent) => void>> = new Map();
  onerror: (() => void) | null = null;
  
  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
  
  addEventListener(type: string, callback: (e: MessageEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }
  
  removeEventListener(type: string, callback: (e: MessageEvent) => void) {
    this.listeners.get(type)?.delete(callback);
  }
  
  dispatchEvent(type: string, data: unknown) {
    const event = { data: JSON.stringify(data) } as MessageEvent;
    this.listeners.get(type)?.forEach(cb => cb(event));
  }
  
  dispatchRawEvent(type: string, data: string) {
    const event = { data } as MessageEvent;
    this.listeners.get(type)?.forEach(cb => cb(event));
  }
  
  triggerError() {
    if (this.onerror) this.onerror();
  }
  
  close() {}
  
  static reset() {
    MockEventSource.instances = [];
  }
  
  static getLastInstance() {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}

(global as any).EventSource = MockEventSource;

import { SSEProvider, useSSE, useFeedFetchEvents, useLogsEvents } from './SSEContext';

describe('SSEContext', () => {
  beforeEach(() => {
    MockEventSource.reset();
  });

  describe('SSEProvider', () => {
    test('creates EventSource on mount', () => {
      render(
        <SSEProvider>
          <div>Test</div>
        </SSEProvider>
      );
      
      expect(MockEventSource.instances).toHaveLength(1);
      expect(MockEventSource.getLastInstance().url).toBe('/api/logs/stream');
    });

    test('closes EventSource on unmount', () => {
      const closeSpy = spyOn(MockEventSource.prototype, 'close');
      
      const { unmount } = render(
        <SSEProvider>
          <div>Test</div>
        </SSEProvider>
      );
      
      unmount();
      
      expect(closeSpy).toHaveBeenCalled();
      closeSpy.mockRestore();
    });

    test('renders children', () => {
      render(
        <SSEProvider>
          <div data-testid="child">Child Content</div>
        </SSEProvider>
      );
      
      expect(screen.getByTestId('child')).toBeDefined();
    });
  });

  describe('useSSE', () => {
    test('throws error when used outside provider', () => {
      const consoleSpy = spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useSSE());
      }).toThrow('useSSE must be used within SSEProvider');
      
      consoleSpy.mockRestore();
    });

    test('returns context value when inside provider', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SSEProvider>{children}</SSEProvider>
      );
      
      const { result } = renderHook(() => useSSE(), { wrapper });
      
      expect(result.current.onFetchComplete).toBeDefined();
      expect(result.current.onLogsInit).toBeDefined();
      expect(result.current.onLogsUpdate).toBeDefined();
      expect(typeof result.current.isOnline).toBe('boolean');
    });

    test('isOnline starts as true', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SSEProvider>{children}</SSEProvider>
      );
      
      const { result } = renderHook(() => useSSE(), { wrapper });
      
      expect(result.current.isOnline).toBe(true);
    });
  });

  describe('onFetchComplete', () => {
    test('registers and unregisters callback', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SSEProvider>{children}</SSEProvider>
      );
      
      const { result } = renderHook(() => useSSE(), { wrapper });
      
      const callback = mock(() => {});
      let unsubscribe: () => void;
      
      act(() => {
        unsubscribe = result.current.onFetchComplete(callback);
      });
      
      expect(typeof unsubscribe!).toBe('function');
      
      act(() => {
        unsubscribe();
      });
    });

    test('callback receives fetch-complete events', async () => {
      const callback = mock(() => {});
      
      const TestComponent = () => {
        const { onFetchComplete } = useSSE();
        React.useEffect(() => {
          return onFetchComplete(callback);
        }, [onFetchComplete]);
        return null;
      };
      
      render(
        <SSEProvider>
          <TestComponent />
        </SSEProvider>
      );
      
      const eventSource = MockEventSource.getLastInstance();
      
      act(() => {
        eventSource.dispatchEvent('fetch-complete', {
          feedId: 'feed-1',
          lastFetchedAt: '2026-02-06T00:00:00Z',
          totalArticles: 10,
        });
      });
      
      expect(callback).toHaveBeenCalledWith({
        feedId: 'feed-1',
        lastFetchedAt: '2026-02-06T00:00:00Z',
        totalArticles: 10,
      });
    });
  });

  describe('onLogsInit', () => {
    test('callback receives init events', async () => {
      const callback = mock(() => {});
      
      const TestComponent = () => {
        const { onLogsInit } = useSSE();
        React.useEffect(() => {
          return onLogsInit(callback);
        }, [onLogsInit]);
        return null;
      };
      
      render(
        <SSEProvider>
          <TestComponent />
        </SSEProvider>
      );
      
      const eventSource = MockEventSource.getLastInstance();
      
      act(() => {
        eventSource.dispatchEvent('init', {
          logs: [{ timestamp: '2026-02-06', level: 'INFO', action: 'FETCH', url: 'https://example.com' }],
        });
      });
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('onLogsUpdate', () => {
    test('callback receives update events', async () => {
      const callback = mock(() => {});
      
      const TestComponent = () => {
        const { onLogsUpdate } = useSSE();
        React.useEffect(() => {
          return onLogsUpdate(callback);
        }, [onLogsUpdate]);
        return null;
      };
      
      render(
        <SSEProvider>
          <TestComponent />
        </SSEProvider>
      );
      
      const eventSource = MockEventSource.getLastInstance();
      
      act(() => {
        eventSource.dispatchEvent('update', {
          logs: [{ timestamp: '2026-02-06', level: 'SUCCESS', action: 'PARSE', url: 'https://example.com' }],
        });
      });
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('system events', () => {
    test('logs system messages', async () => {
      const logSpy = spyOn(console, 'log').mockImplementation(() => {});
      
      render(
        <SSEProvider>
          <div>Test</div>
        </SSEProvider>
      );
      
      const eventSource = MockEventSource.getLastInstance();
      
      act(() => {
        eventSource.dispatchEvent('system', { message: 'Connected' });
      });
      
      expect(logSpy).toHaveBeenCalledWith('System:', 'Connected');
      logSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    test('sets isOnline to false on error', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SSEProvider>{children}</SSEProvider>
      );
      
      const { result } = renderHook(() => useSSE(), { wrapper });
      
      const eventSource = MockEventSource.getLastInstance();
      
      act(() => {
        eventSource.triggerError();
      });
      
      await waitFor(() => {
        expect(result.current.isOnline).toBe(false);
      });
    });

    test('handles invalid JSON in fetch-complete event', async () => {
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <SSEProvider>
          <div>Test</div>
        </SSEProvider>
      );
      
      const eventSource = MockEventSource.getLastInstance();
      
      act(() => {
        eventSource.dispatchRawEvent('fetch-complete', 'invalid-json');
      });
      
      expect(errorSpy).toHaveBeenCalledWith('Failed to parse fetch-complete event:', expect.any(Error));
      errorSpy.mockRestore();
    });

    test('handles invalid JSON in init event', async () => {
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <SSEProvider>
          <div>Test</div>
        </SSEProvider>
      );
      
      const eventSource = MockEventSource.getLastInstance();
      
      act(() => {
        eventSource.dispatchRawEvent('init', 'invalid-json');
      });
      
      expect(errorSpy).toHaveBeenCalledWith('Failed to parse init event:', expect.any(Error));
      errorSpy.mockRestore();
    });

    test('handles invalid JSON in update event', async () => {
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <SSEProvider>
          <div>Test</div>
        </SSEProvider>
      );
      
      const eventSource = MockEventSource.getLastInstance();
      
      act(() => {
        eventSource.dispatchRawEvent('update', 'invalid-json');
      });
      
      expect(errorSpy).toHaveBeenCalledWith('Failed to parse update event:', expect.any(Error));
      errorSpy.mockRestore();
    });

    test('handles invalid JSON in system event', async () => {
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <SSEProvider>
          <div>Test</div>
        </SSEProvider>
      );
      
      const eventSource = MockEventSource.getLastInstance();
      
      act(() => {
        eventSource.dispatchRawEvent('system', 'invalid-json');
      });
      
      expect(errorSpy).toHaveBeenCalledWith('Failed to parse system event:', expect.any(Error));
      errorSpy.mockRestore();
    });
  });

  describe('useFeedFetchEvents', () => {
    test('does nothing when no callback provided', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SSEProvider>{children}</SSEProvider>
      );
      
      const { result } = renderHook(() => useFeedFetchEvents(), { wrapper });
      
      expect(result.current).toBeUndefined();
    });

    test('subscribes to fetch-complete events', () => {
      const callback = mock(() => {});
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SSEProvider>{children}</SSEProvider>
      );
      
      renderHook(() => useFeedFetchEvents({ onFetchComplete: callback }), { wrapper });
      
      const eventSource = MockEventSource.getLastInstance();
      
      act(() => {
        eventSource.dispatchEvent('fetch-complete', {
          feedId: 'feed-1',
          lastFetchedAt: null,
          totalArticles: 5,
        });
      });
      
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('useLogsEvents', () => {
    test('does nothing when no callbacks provided', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SSEProvider>{children}</SSEProvider>
      );
      
      const { result } = renderHook(() => useLogsEvents(), { wrapper });
      
      expect(result.current).toBeUndefined();
    });

    test('subscribes to init events', () => {
      const callback = mock(() => {});
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SSEProvider>{children}</SSEProvider>
      );
      
      renderHook(() => useLogsEvents({ onInit: callback }), { wrapper });
      
      const eventSource = MockEventSource.getLastInstance();
      
      act(() => {
        eventSource.dispatchEvent('init', { logs: [] });
      });
      
      expect(callback).toHaveBeenCalled();
    });

    test('subscribes to update events', () => {
      const callback = mock(() => {});
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SSEProvider>{children}</SSEProvider>
      );
      
      renderHook(() => useLogsEvents({ onUpdate: callback }), { wrapper });
      
      const eventSource = MockEventSource.getLastInstance();
      
      act(() => {
        eventSource.dispatchEvent('update', { logs: [] });
      });
      
      expect(callback).toHaveBeenCalled();
    });

    test('subscribes to both init and update events', () => {
      const onInit = mock(() => {});
      const onUpdate = mock(() => {});
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SSEProvider>{children}</SSEProvider>
      );
      
      renderHook(() => useLogsEvents({ onInit, onUpdate }), { wrapper });
      
      const eventSource = MockEventSource.getLastInstance();
      
      act(() => {
        eventSource.dispatchEvent('init', { logs: [] });
        eventSource.dispatchEvent('update', { logs: [] });
      });
      
      expect(onInit).toHaveBeenCalled();
      expect(onUpdate).toHaveBeenCalled();
    });
  });
});
