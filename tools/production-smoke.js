const backendUrl = String(process.env.BACKEND_URL || '').trim().replace(/\/$/, '');
const frontendUrl = String(process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
const expectedCommit = String(process.env.EXPECTED_COMMIT || '').trim();

if (!backendUrl) {
  console.error('BACKEND_URL is required, for example https://worktrack-backend.onrender.com');
  process.exit(1);
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    return await fetch(url, {
      redirect: 'follow',
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkBackend() {
  const response = await request(`${backendUrl}/api/health`);
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(`Backend health failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  if (!payload?.database?.connected) {
    throw new Error('Backend responded, but database.connected is not true');
  }

  const deployedCommit = String(payload?.deployment?.commit || '').trim();
  if (expectedCommit && !deployedCommit) {
    throw new Error('EXPECTED_COMMIT was provided, but backend health did not report deployment.commit');
  }
  if (expectedCommit && deployedCommit !== expectedCommit) {
    throw new Error(`Deploy commit mismatch: expected ${expectedCommit}, got ${deployedCommit}`);
  }

  console.log('Backend health: OK');
  console.log(`Database: ${payload.database.provider || 'unknown'} connected`);
  console.log(`Deployment provider: ${payload?.deployment?.provider || 'unknown'}`);
  if (payload?.deployment?.externalUrl) {
    console.log(`Render URL: ${payload.deployment.externalUrl}`);
  }
  if (deployedCommit) {
    console.log(`Deploy commit: ${deployedCommit}`);
  }
}

async function checkFrontendPage(url, label) {
  const response = await request(url, {
    headers: { Accept: 'text/html' },
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${label} check failed (${response.status})`);
  }

  if (!/<html[\s>]/i.test(body) || !/worktrack/i.test(body)) {
    throw new Error(`${label} response does not look like the WorkTrack HTML app`);
  }

  console.log(`${label}: OK (${response.url})`);
}

async function checkFrontend() {
  if (!frontendUrl) {
    console.log('Frontend check: skipped (FRONTEND_URL not set)');
    return;
  }

  await checkFrontendPage(frontendUrl, 'Frontend root');
  await checkFrontendPage(`${frontendUrl}/sign-in`, 'Frontend SPA route');
}

try {
  await checkBackend();
  await checkFrontend();
  console.log('Production smoke: PASS');
} catch (error) {
  console.error(`Production smoke: FAIL — ${error?.message || error}`);
  process.exit(1);
}
