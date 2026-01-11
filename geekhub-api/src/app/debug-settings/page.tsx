"use client";

import { useSettings } from '@/lib/settings';
import { useEffect } from 'react';

export default function SettingsDebugPage() {
  const { settings, isReady } = useSettings();

  useEffect(() => {
    if (isReady) {
      console.log('Settings loaded:', settings);
      console.log('AI Settings:', settings.ai);
      console.log('AI Enabled:', settings.ai.enabled);
      console.log('API Key:', settings.ai.apiKey);
      console.log('Base URL:', settings.ai.baseUrl);
    }
  }, [settings, isReady]);

  if (!isReady) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Settings Debug</h1>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">AI Settings</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm">
            {JSON.stringify(settings.ai, null, 2)}
          </pre>
        </div>
        <div>
          <h2 className="text-lg font-semibold">All Settings</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm">
            {JSON.stringify(settings, null, 2)}
          </pre>
        </div>
        <div>
          <h2 className="text-lg font-semibold">LocalStorage Raw</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm">
            {typeof window !== 'undefined' ? localStorage.getItem('geekhub_settings') : 'N/A'}
          </pre>
        </div>
      </div>
    </div>
  );
}