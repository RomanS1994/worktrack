import fs from 'node:fs';
import path from 'node:path';

const roots = ['frontend/driverApp/src/react-app', 'frontend/adminApp/src/react-app'];
const exts = new Set(['.js', '.jsx', '.ts', '.tsx']);
const patterns = [
  [/from\s+(['"])(?:\.\.\/)+app\//g, (_match, quote) => `from ${quote}@shared/app/`],
  [/from\s+(['"])(?:\.\.\/)+features\/auth\//g, (_match, quote) => `from ${quote}@shared/features/auth/`],
  [/from\s+(['"])(?:\.\.\/)+features\/manager\//g, (_match, quote) => `from ${quote}@shared/features/manager/`],
];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!exts.has(path.extname(entry.name))) {
      continue;
    }

    const before = fs.readFileSync(fullPath, 'utf8');
    let after = before;

    for (const [regex, replacer] of patterns) {
      after = after.replace(regex, replacer);
    }

    if (after !== before) {
      fs.writeFileSync(fullPath, after);
    }
  }
}

for (const root of roots) {
  walk(root);
}
