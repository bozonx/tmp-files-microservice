/**
 * Network-related utility functions
 */

/**
 * Checks if the given URL hostname is a private or loopback address
 * @param url - URL to check
 * @returns true if the hostname is private, false otherwise
 */
export function isPrivateHost(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost') {
    return true;
  }

  // Literal IPv4 checks
  const ipv4 = hostname.match(/^\d+\.\d+\.\d+\.\d+$/);
  if (ipv4) {
    const [a, b] = hostname.split('.').map(n => parseInt(n, 10));
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local
    return false;
  }

  // IPv6 loopback / link-local
  if (hostname === '::1' || hostname.startsWith('fe80:')) {
    return true;
  }

  // For non-literal hostnames we don't resolve DNS here; assume public
  return false;
}
