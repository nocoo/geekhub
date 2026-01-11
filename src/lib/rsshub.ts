/**
 * RssHub URL parser and utilities
 *
 * RssHub protocol: rsshub://[host]/namespace/route[?param=value]
 * Examples:
 *   rsshub://sspai/index
 *   rsshub://rsshub.app/twitter/user/karlseguin
 *   rsshub://my-instance.local/juecin/category/backend
 */

export interface RssHubParseResult {
  isValid: boolean;
  feedUrl?: string;
  baseUrl?: string;
  error?: string;
}

export interface RssHubConfig {
  instanceUrl?: string; // Default RssHub instance URL (optional)
}

/**
 * Parse rsshub:// protocol URL to HTTPS feed URL
 */
export function parseRssHubUrl(
  input: string,
  config?: RssHubConfig
): RssHubParseResult {
  if (!input || typeof input !== 'string') {
    return { isValid: false, error: 'Invalid input' };
  }

  const defaultInstance = config?.instanceUrl || 'https://rsshub.app';

  try {
    // Handle rsshub:// protocol (custom protocol, can't use URL constructor)
    // Format 1: rsshub://namespace/route -> use configured instance
    // Format 2: rsshub://custom-instance/namespace/route -> use custom instance
    if (input.startsWith('rsshub://')) {
      // Remove rsshub:// prefix
      const withoutProtocol = input.substring(9); // 'rsshub://'.length = 9

      // Check if the first part looks like a domain (contains .)
      // e.g., my-rsshub.com in rsshub://my-rsshub.com/sspai/index
      const firstSlashIndex = withoutProtocol.indexOf('/');

      if (firstSlashIndex === -1) {
        // No slash, treat entire string as path
        const feedUrl = `${defaultInstance}/${withoutProtocol}`;
        return {
          isValid: true,
          feedUrl,
          baseUrl: defaultInstance,
        };
      }

      const firstPart = withoutProtocol.substring(0, firstSlashIndex);
      const rest = withoutProtocol.substring(firstSlashIndex + 1);

      // If first part contains '.', it's likely a custom instance
      if (firstPart.includes('.')) {
        const customInstance = `https://${firstPart}`;
        const feedUrl = `${customInstance}/${rest}`;
        return {
          isValid: true,
          feedUrl,
          baseUrl: customInstance,
        };
      } else {
        // Use configured/default instance
        const feedUrl = `${defaultInstance}/${withoutProtocol}`;
        return {
          isValid: true,
          feedUrl,
          baseUrl: defaultInstance,
        };
      }
    }

    // Handle https:// RssHub URLs
    if (input.startsWith('https://') || input.startsWith('http://')) {
      // Check if it's a RssHub URL
      const url = new URL(input);
      const host = url.hostname;

      // Common RssHub hostnames
      const rsshubHosts = [
        'rsshub.app',
        'rsshub.rssforever.com',
        'rss.wifease.com',
      ];

      const isRssHub =
        rsshubHosts.some(h => host === h || host.endsWith(`.${h}`)) ||
        host.includes('rsshub');

      if (isRssHub) {
        return {
          isValid: true,
          feedUrl: input,
          baseUrl: `${url.protocol}//${host}`,
        };
      }

      return {
        isValid: false,
        error: 'Not a RssHub URL',
      };
    }

    // Might be a namespace/route path
    if (input.includes('/') && !input.startsWith('http')) {
      const feedUrl = `${defaultInstance}/${input}`;
      return {
        isValid: true,
        feedUrl,
        baseUrl: defaultInstance,
      };
    }

    return {
      isValid: false,
      error: 'Invalid RssHub URL format',
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Convert any input to final HTTPS feed URL
 * Handles rsshub://, https://, and namespace/route formats
 */
export function resolveRssHubUrl(
  input: string,
  config?: RssHubConfig
): string | null {
  const result = parseRssHubUrl(input, config);
  return result.feedUrl || null;
}

/**
 * Check if a URL is a RssHub URL
 */
export function isRssHubUrl(input: string, config?: RssHubConfig): boolean {
  return parseRssHubUrl(input, config).isValid;
}

/**
 * Extract namespace and route from RssHub URL
 */
export function extractRssHubRoute(input: string): {
  namespace: string | null;
  route: string | null;
  fullRoute: string | null;
} {
  const result = parseRssHubUrl(input);
  if (!result.isValid || !result.feedUrl) {
    return { namespace: null, route: null, fullRoute: null };
  }

  try {
    const url = new URL(result.feedUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts.length < 2) {
      return { namespace: null, route: null, fullRoute: null };
    }

    const namespace = pathParts[0];
    const route = pathParts.slice(1).join('/');
    const fullRoute = pathParts.join('/');

    return { namespace, route, fullRoute };
  } catch {
    return { namespace: null, route: null, fullRoute: null };
  }
}
