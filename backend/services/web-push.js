import {
  createCipheriv,
  createECDH,
  createHash,
  createPrivateKey,
  hkdfSync,
  randomBytes,
  sign,
} from 'node:crypto';

const P256_ORDER = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551');
const VAPID_SUBJECT = 'mailto:notifications@worktrack.app';

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value) {
  return Buffer.from(String(value || ''), 'base64url');
}

function privateScalarFromSecret(secret) {
  for (let counter = 0; counter < 32; counter += 1) {
    const digest = createHash('sha256')
      .update(`worktrack:web-push:v1:${counter}:`)
      .update(secret)
      .digest();
    const scalar = BigInt(`0x${digest.toString('hex')}`);
    if (scalar > 0n && scalar < P256_ORDER) return digest;
  }
  throw new Error('Unable to derive Web Push signing key');
}

function getVapidKeyPair() {
  const secret = String(process.env.AUTH_TOKEN_SECRET || '').trim();
  if (!secret) throw new Error('AUTH_TOKEN_SECRET is required for Web Push');

  const privateKeyBytes = privateScalarFromSecret(secret);
  const ecdh = createECDH('prime256v1');
  ecdh.setPrivateKey(privateKeyBytes);
  const publicKey = ecdh.getPublicKey(null, 'uncompressed');
  const x = publicKey.subarray(1, 33);
  const y = publicKey.subarray(33, 65);
  const privateKey = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: toBase64Url(x),
      y: toBase64Url(y),
      d: toBase64Url(privateKeyBytes),
    },
    format: 'jwk',
  });

  return { publicKey, privateKey };
}

function makeVapidJwt(endpoint, keyPair) {
  const header = toBase64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = toBase64Url(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60),
    sub: VAPID_SUBJECT,
  }));
  const input = `${header}.${payload}`;
  const signature = sign('sha256', Buffer.from(input), {
    key: keyPair.privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${input}.${toBase64Url(signature)}`;
}

function encryptPayload(subscription, payload) {
  const clientPublicKey = fromBase64Url(subscription?.keys?.p256dh);
  const authSecret = fromBase64Url(subscription?.keys?.auth);
  if (clientPublicKey.length !== 65 || authSecret.length < 16) {
    throw new Error('Invalid Web Push subscription keys');
  }

  const serverEcdh = createECDH('prime256v1');
  serverEcdh.generateKeys();
  const serverPublicKey = serverEcdh.getPublicKey(null, 'uncompressed');
  const sharedSecret = serverEcdh.computeSecret(clientPublicKey);
  const info = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    clientPublicKey,
    serverPublicKey,
  ]);
  const ikm = Buffer.from(hkdfSync('sha256', sharedSecret, authSecret, info, 32));
  const salt = randomBytes(16);
  const cek = Buffer.from(hkdfSync(
    'sha256',
    ikm,
    salt,
    Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'),
    16,
  ));
  const nonce = Buffer.from(hkdfSync(
    'sha256',
    ikm,
    salt,
    Buffer.from('Content-Encoding: nonce\0', 'utf8'),
    12,
  ));

  const plain = Buffer.concat([Buffer.from(JSON.stringify(payload), 'utf8'), Buffer.from([0x02])]);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);

  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublicKey.length]),
    serverPublicKey,
    encrypted,
  ]);
}

export function getVapidPublicKey() {
  return toBase64Url(getVapidKeyPair().publicKey);
}

export async function sendWebPush(subscription, payload) {
  const endpoint = String(subscription?.endpoint || '');
  if (!endpoint.startsWith('https://')) throw new Error('Invalid Web Push endpoint');

  const keyPair = getVapidKeyPair();
  const jwt = makeVapidJwt(endpoint, keyPair);
  const body = encryptPayload(subscription, payload);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${toBase64Url(keyPair.publicKey)}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
    },
    body,
  });

  return {
    ok: response.ok,
    status: response.status,
    expired: response.status === 404 || response.status === 410,
  };
}
