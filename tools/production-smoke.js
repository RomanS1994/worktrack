const backendUrl = String(process.env.BACKEND_URL || '').trim().replace(/\/$/, '');
const frontendUrl = String(process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
const expectedCommit = String(process.env.EXPECTED_COMMIT || '').trim();
const maxAttempts = Math.max(1, Number.parseInt(process.env.SMOKE_ATTEMPTS || '1', 10) || 1);
const retryDelayMs = Math.max(0, Number.parseInt(process.env.SMOKE_DELAY_MS || '30000', 10) || 0);

if (!backendUrl) {
  console.error('BACKEND_URL is required, for example https://worktrack-backend.onrender.com');
  process.exit(1);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

async function runSmoke() {
  await checkBackend();
  await checkFrontend();
}

let lastError = null;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    console.log(`Production smoke attempt ${attempt}/${maxAttempts}`);
    await runSmoke();
    console.log('Production smoke: PASS');
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`Attempt ${attempt} failed — ${error?.message || error}`);
    if (attempt < maxAttempts) {
      console.log(`Retrying in ${Math.round(retryDelayMs / 1000)}s...`);
      await sleep(retryDelayMs);
    }
  }
}

console.error(`Production smoke: FAIL — ${lastError?.message || lastError}`);
process.exit(1);
