import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSettings, type AppSettings } from './settings';

const STORAGE_KEY = 'geekhub_settings';

describe('useSettings', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};

    // @ts-ignore - mocking localStorage
    global.localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; },
      length: 0,
      key: () => null,
    };
  });

  afterEach(() => {
    mockStorage = {};
  });

  const DEFAULT_SETTINGS: AppSettings = {
    proxy: {
      enabled: false,
      autoDetect: true,
      host: '127.0.0.1',
      port: '7890',
    },
    ai: {
      enabled: false,
      provider: 'AIMixHub',
      apiKey: '',
      baseUrl: 'https://api.aimixhub.com/v1',
      model: 'gpt-4o-mini',
    },
    rsshub: {
      enabled: false,
      url: 'https://rsshub.app',
    },
  };

  describe('initialization', () => {
    test('returns default settings when localStorage is empty', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });

    test('loads settings from localStorage', async () => {
      const customSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        proxy: { ...DEFAULT_SETTINGS.proxy, enabled: true, host: '192.168.1.1' },
      };
      mockStorage[STORAGE_KEY] = JSON.stringify(customSettings);

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.settings.proxy.enabled).toBe(true);
      expect(result.current.settings.proxy.host).toBe('192.168.1.1');
    });

    test('merges partial settings with defaults', async () => {
      mockStorage[STORAGE_KEY] = JSON.stringify({
        proxy: { enabled: true },
      });

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.settings.proxy.enabled).toBe(true);
      expect(result.current.settings.proxy.host).toBe('127.0.0.1');
      expect(result.current.settings.ai).toEqual(DEFAULT_SETTINGS.ai);
    });

    test('handles invalid JSON gracefully', async () => {
      mockStorage[STORAGE_KEY] = 'invalid-json';

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('updateSettings', () => {
    test('updates settings and persists to localStorage', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.updateSettings({
          proxy: { ...DEFAULT_SETTINGS.proxy, enabled: true },
        });
      });

      expect(result.current.settings.proxy.enabled).toBe(true);

      const stored = JSON.parse(mockStorage[STORAGE_KEY]);
      expect(stored.proxy.enabled).toBe(true);
    });

    test('preserves unmodified settings', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.updateSettings({
          ai: { ...DEFAULT_SETTINGS.ai, enabled: true },
        });
      });

      expect(result.current.settings.proxy).toEqual(DEFAULT_SETTINGS.proxy);
      expect(result.current.settings.ai.enabled).toBe(true);
    });
  });

  describe('updateProxy', () => {
    test('updates only proxy settings', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.updateProxy({ enabled: true, port: '1080' });
      });

      expect(result.current.settings.proxy.enabled).toBe(true);
      expect(result.current.settings.proxy.port).toBe('1080');
      expect(result.current.settings.proxy.host).toBe('127.0.0.1');
    });
  });

  describe('updateAI', () => {
    test('updates only AI settings', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.updateAI({ 
          enabled: true, 
          apiKey: 'sk-test-key',
          model: 'gpt-4',
        });
      });

      expect(result.current.settings.ai.enabled).toBe(true);
      expect(result.current.settings.ai.apiKey).toBe('sk-test-key');
      expect(result.current.settings.ai.model).toBe('gpt-4');
      expect(result.current.settings.ai.provider).toBe('AIMixHub');
    });
  });

  describe('updateRssHub', () => {
    test('updates only RssHub settings', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.updateRssHub({ 
          enabled: true,
          url: 'https://my-rsshub.example.com',
        });
      });

      expect(result.current.settings.rsshub.enabled).toBe(true);
      expect(result.current.settings.rsshub.url).toBe('https://my-rsshub.example.com');
    });
  });

  describe('resetSettings', () => {
    test('resets all settings to defaults', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.updateProxy({ enabled: true });
      });

      act(() => {
        result.current.updateAI({ enabled: true, apiKey: 'test' });
      });

      await waitFor(() => {
        expect(result.current.settings.proxy.enabled).toBe(true);
      });

      act(() => {
        result.current.resetSettings();
      });

      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
      
      const stored = JSON.parse(mockStorage[STORAGE_KEY]);
      expect(stored).toEqual(DEFAULT_SETTINGS);
    });
  });
});
