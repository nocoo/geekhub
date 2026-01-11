/**
 * Convert image URL to proxy URL with referer support
 * Used to bypass anti-hotlinking protection
 */
export function getProxyImageUrl(imageUrl: string, referer?: string): string {
  // Use proxy endpoint
  const proxyUrl = `/api/image-proxy`;

  // Encode URL and referer as JSON
  const payload = { url: imageUrl, referer };

  // Convert to base64 to pass as query param
  const encoded = btoa(JSON.stringify(payload));

  return `${proxyUrl}?data=${encoded}`;
}

/**
 * Extract domain from URL for use as referer
 */
export function getRefererFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}/`;
  } catch {
    return '';
  }
}
