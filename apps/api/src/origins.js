export function parseOrigins(value = 'http://127.0.0.1:5173,http://localhost:5173') {
  const origins = value.split(',').map((entry) => {
    const input = entry.trim();
    let url;
    try { url = new URL(input); } catch { throw new Error('APP_ORIGINS must contain exact HTTP(S) origins.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || input.includes('*')) throw new Error('APP_ORIGINS must contain exact HTTP(S) origins without paths or wildcards.');
    if (!/^https?:\/\/[^/?#]+\/?$/i.test(input)) throw new Error('APP_ORIGINS must contain exact HTTP(S) origins.');
    return url.origin;
  });
  return [...new Set(origins)];
}

export const allowedOrigins = parseOrigins(process.env.APP_ORIGINS);
export function hostingInfo(origins = allowedOrigins) {
  const joinUrls = origins.filter((origin) => {
    const hostname = new URL(origin).hostname;
    return hostname !== 'localhost' && !hostname.endsWith('.localhost') && !/^127\./.test(hostname) && hostname !== '[::1]';
  });
  return { lanConfigured: joinUrls.length > 0, joinUrls };
}
