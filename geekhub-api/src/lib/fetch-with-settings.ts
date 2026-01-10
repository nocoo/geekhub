"use client";

/**
 * Fetch feed with proxy and RssHub settings from localStorage
 */
export async function fetchFeedWithSettings(feedId: string): Promise<Response> {
  // Get settings from localStorage
  const settingsJson = localStorage.getItem('geekhub_settings');
  const settings = settingsJson ? JSON.parse(settingsJson) : null;

  const body: any = {};

  // Add proxy settings if enabled
  if (settings?.proxy?.enabled) {
    body.proxy = settings.proxy;
  }

  // Add RssHub settings if enabled
  if (settings?.rsshub?.enabled) {
    body.rsshub = settings.rsshub;
  }

  return fetch(`/api/feeds/${feedId}/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
