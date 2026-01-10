"use client";

import { useEffect, useState } from 'react';

export interface ProxySettings {
  enabled: boolean;
  autoDetect: boolean;
  host: string;
  port: string;
}

export interface AISettings {
  enabled: boolean;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model?: string;
}

export interface RssHubSettings {
  enabled: boolean;
  url: string;
}

export interface AppSettings {
  proxy: ProxySettings;
  ai: AISettings;
  rsshub: RssHubSettings;
}

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

const STORAGE_KEY = 'geekhub_settings';

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }

  return DEFAULT_SETTINGS;
}

function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setIsReady(true);
  }, []);

  const updateSettings = (updates: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const updateProxy = (proxy: Partial<ProxySettings>) => {
    updateSettings({ proxy: { ...settings.proxy, ...proxy } });
  };

  const updateAI = (ai: Partial<AISettings>) => {
    updateSettings({ ai: { ...settings.ai, ...ai } });
  };

  const updateRssHub = (rsshub: Partial<RssHubSettings>) => {
    updateSettings({ rsshub: { ...settings.rsshub, ...rsshub } });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  };

  return {
    settings,
    isReady,
    updateSettings,
    updateProxy,
    updateAI,
    updateRssHub,
    resetSettings,
  };
}
