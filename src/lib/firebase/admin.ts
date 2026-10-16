import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import type { Auth } from 'firebase-admin/auth';

// Guard against accidental client-side bundling/execution
if (typeof window !== 'undefined') {
  throw new Error('[Security Violation] src/lib/firebase/admin cannot be imported in client-side code.');
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

// Replace escaped newlines if passed via environment variables
const privateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, '\n') : undefined;

export const isFirebaseAdminConfigured = Boolean(
  projectId &&
  ((clientEmail && privateKey) || process.env.GOOGLE_APPLICATION_CREDENTIALS)
);

import https from 'https';

// Configure HTTPS agent with relaxed TLS checks in development if corporate/proxy SSL inspection is active
const adminHttpAgent = new https.Agent({
  rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0' && process.env.NODE_ENV === 'production',
});

function getFirebaseAdminApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0]!;
  }

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      httpAgent: adminHttpAgent,
    });
  }

  // Fallback to application default credentials (useful on Google Cloud / Firebase Hosting)
  return initializeApp({
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    httpAgent: adminHttpAgent,
  });
}

export async function getAdminAuth(): Promise<Auth> {
  const { getAuth } = await import('firebase-admin/auth');
  return getAuth(getFirebaseAdminApp());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}

export function getAdminStorage(): Storage {
  return getStorage(getFirebaseAdminApp());
}
