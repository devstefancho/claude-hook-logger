const HUES = [210, 340, 120, 45, 270, 180, 15, 300, 90, 160, 240, 60];

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getSessionColor(sessionId: string): string {
  const hue = HUES[hashString(sessionId) % HUES.length];
  return `hsl(${hue}, 65%, 62%)`;
}

export function getSessionColorBg(sessionId: string): string {
  const hue = HUES[hashString(sessionId) % HUES.length];
  return `hsla(${hue}, 65%, 62%, 0.15)`;
}
