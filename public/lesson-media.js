export function videoEmbed(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;

  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com', 'youtu.be'].includes(url.hostname)) {
    const path = url.pathname.split('/');
    const id = url.hostname === 'youtu.be' ? path[1]
      : url.pathname === '/watch' ? url.searchParams.get('v')
      : ['embed', 'shorts', 'live'].includes(path[1]) ? path[2] : null;
    if (/^[\w-]{11}$/.test(id ?? '')) return 'https://www.youtube-nocookie.com/embed/' + id;
  }

  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
    const match = url.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?\/?$/);
    const hash = match?.[2] ?? url.searchParams.get('h');
    if (match) return 'https://player.vimeo.com/video/' + match[1]
      + (hash && /^[a-zA-Z0-9]+$/.test(hash) ? '?h=' + hash : '');
  }
  return null;
}
