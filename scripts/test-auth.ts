import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      process.env[k] = v;
    }
  }
}

import { authenticateRequest } from '../src/lib/server/authenticateRequest';

async function main() {
  console.log('--- Test 1: With .env.local loaded ---');
  let req = new Request('http://localhost:3000/api/resume/extract', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' }
  });
  console.log('Result 1:', await authenticateRequest(req));

  console.log('--- Test 2: If resolveAuthProvider returns supabase ---');
  process.env.NEXT_PUBLIC_BACKEND_PROVIDER = 'supabase';
  console.log('Result 2:', await authenticateRequest(req));

  console.log('--- Test 3: If Firebase project id is missing ---');
  process.env.NEXT_PUBLIC_BACKEND_PROVIDER = 'firebase';
  delete process.env.FIREBASE_PROJECT_ID;
  delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  console.log('Result 3:', await authenticateRequest(req));
}

main().catch(err => console.error('Error in main:', err));
