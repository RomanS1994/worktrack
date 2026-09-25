import { createHash } from 'node:crypto';

import { setCorsHeaders } from '../lib/http.js';

function avatarDataUrlFromProfile(profileOrDataUrl) {
  if (typeof profileOrDataUrl === 'string') return profileOrDataUrl;
  if (!profileOrDataUrl || typeof profileOrDataUrl !== 'object' || Array.isArray(profileOrDataUrl)) return '';
  return typeof profileOrDataUrl.avatarDataUrl === 'string' ? profileOrDataUrl.avatarDataUrl : '';
}

function parseAvatarDataUrl(profileOrDataUrl) {
  const dataUrl = avatarDataUrlFromProfile(profileOrDataUrl);
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) return null;

  const contentType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) return null;

  return {
    contentType,
    buffer,
    hash: createHash('sha256').update(buffer).digest('hex').slice(0, 24),
  };
}

export function avatarHash(profileOrDataUrl) {
  const avatar = parseAvatarDataUrl(profileOrDataUrl);
  if (avatar) return avatar.hash;
  const dataUrl = avatarDataUrlFromProfile(profileOrDataUrl);
  if (!dataUrl) return '';
  return createHash('sha256').update(dataUrl).digest('hex').slice(0, 24);
}

export function avatarUrl(userId, profileOrDataUrl) {
  const hash = avatarHash(profileOrDataUrl);
  if (!userId || !hash) return '';
  return `/api/avatars/${encodeURIComponent(userId)}/${hash}`;
}

export function avatarUrlFromRecord(userId, avatar) {
  if (!userId || !avatar?.hash) return '';
  return `/api/avatars/${encodeURIComponent(userId)}/${avatar.hash}`;
}

export function profileWithoutAvatarData(profile) {
  const normalized = profile && typeof profile === 'object' && !Array.isArray(profile) ? { ...profile } : {};
  delete normalized.avatarDataUrl;
  return normalized;
}

export async function storeUserAvatar(client, userId, profileOrDataUrl) {
  const avatar = parseAvatarDataUrl(profileOrDataUrl);
  if (!userId || !avatar || !client?.userAvatar?.upsert) {
    return null;
  }

  return client.userAvatar.upsert({
    where: { userId },
    create: {
      userId,
      contentType: avatar.contentType,
      data: avatar.buffer,
      hash: avatar.hash,
    },
    update: {
      contentType: avatar.contentType,
      data: avatar.buffer,
      hash: avatar.hash,
    },
  });
}

export async function deleteUserAvatar(client, userId) {
  if (!userId || !client?.userAvatar?.deleteMany) return;
  await client.userAvatar.deleteMany({ where: { userId } });
}

export async function getUserAvatarUrl(client, userId, fallbackProfile = null) {
  if (!userId) return '';
  if (!client?.userAvatar?.findUnique) {
    return avatarUrl(userId, fallbackProfile);
  }
  const avatar = await client.userAvatar.findUnique({
    where: { userId },
    select: { hash: true },
  });
  return avatarUrlFromRecord(userId, avatar) || avatarUrl(userId, fallbackProfile);
}

export async function sendUserAvatar(client, response, userId, requestedHash) {
  const storedAvatar = await client.userAvatar.findUnique({
    where: { userId },
    select: {
      contentType: true,
      data: true,
      hash: true,
      user: { select: { deletedAt: true } },
    },
  });

  if (storedAvatar && !storedAvatar.user?.deletedAt && storedAvatar.hash === requestedHash) {
    const buffer = Buffer.from(storedAvatar.data);
    setCorsHeaders(response);
    response.writeHead(200, {
      'Content-Type': storedAvatar.contentType,
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    response.end(buffer);
    return;
  }

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