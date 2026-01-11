/**
 * Display utilities for RssHub URLs
 * Converts resolved URLs back to rsshub:// format for user display
 */

/**
 * Check if a URL is a resolved RssHub URL
 * by testing if it matches known RssHub patterns
 */
function isResolvedRssHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // Known RssHub hostnames
    const rsshubHosts = [
      'rsshub.app',
      'rsshub.rssforever.com',
      'rss.wifease.com',
    ];

    // Check if hostname contains 'rsshub' or matches known hosts
    return rsshubHosts.some(h => hostname === h || hostname.endsWith(`.${h}`)) ||
           hostname.includes('rsshub') ||
           hostname.includes('hexly.ai'); // Custom RssHub instance
  } catch {
    return false;
  }
}

/**
 * Convert a resolved RssHub URL back to rsshub:// format
 * e.g., https://rsshub.hexly.ai/sspai/index -> rsshub://sspai/index
 */
export function toRssHubProtocol(url: string, instanceUrl?: string): string {
  // If already in rsshub:// format, return as-is
  if (url.startsWith('rsshub://')) {
    return url;
  }

  // Check if it's a resolved RssHub URL
  if (!isResolvedRssHubUrl(url)) {
    return url; // Not a RssHub URL, return original
  }

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    // Remove leading slash
    const path = pathname.startsWith('/') ? pathname.substring(1) : pathname;

    // Check if the instance matches the configured one
    const instanceMatches = instanceUrl && parsed.origin === instanceUrl;

    // If matches configured instance or is a known RssHub instance, convert to protocol
    if (instanceMatches || isResolvedRssHubUrl(url)) {
      return `rsshub://${path}`;
    }

    return url;
  } catch {
    return url;
  }
}

/**
 * Format feed URL for display
 * - RssHub URLs: show as rsshub://...
 * - Other URLs: show as-is
 */
export function formatFeedUrlForDisplay(url: string, instanceUrl?: string): string {
  return toRssHubProtocol(url, instanceUrl);
}
