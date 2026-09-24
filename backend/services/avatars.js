import { createHash } from 'node:crypto';

import { setCorsHeaders } from '../lib/http.js';

function avatarDataUrlFromProfile(profileOrDataUrl) {
  if (typeof profileOrDataUrl === 'string') return profileOrDataUrl;
  if (!profileOrDataUrl || typeof profileOrDataUrl !== 'object' || Array.isArray(profileOrDataUrl)) return '';
  return typeof profileOrDataUrl.avatarDataUrl === 'string' ? profileOrDataUrl.avatarDataUrl : '';
}

export function avatarHash(profileOrDataUrl) {
  const dataUrl = avatarDataUrlFromProfile(profileOrDataUrl);
  if (!dataUrl) return '';
  return createHash('sha256').update(dataUrl).digest('hex').slice(0, 24);
}

export function avatarUrl(userId, profileOrDataUrl) {
  const hash = avatarHash(profileOrDataUrl);
  if (!userId || !hash) return '';
  return `/api/avatars/${encodeURIComponent(userId)}/${hash}`;
}

function parseAvatarDataUrl(profileOrDataUrl) {
  const dataUrl = avatarDataUrlFromProfile(profileOrDataUrl);
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) return null;

  const contentType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  return {
    contentType,
    buffer: Buffer.from(match[2], 'base64'),
  };
}

export async function sendUserAvatar(client, response, userId, requestedHash) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { profile: true, deletedAt: true },
  });

  if (!user || user.deletedAt || avatarHash(user.profile) !== requestedHash) {
    setCorsHeaders(response);
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Avatar not found');
    return;
  }

  const avatar = parseAvatarDataUrl(user.profile);
  if (!avatar) {
    setCorsHeaders(response);
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Avatar not found');
    return;
  }

  setCorsHeaders(response);
  response.writeHead(200, {
    'Content-Type': avatar.contentType,
    'Content-Length': avatar.buffer.length,
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  response.end(avatar.buffer);
}
