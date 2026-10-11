import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

const isValidFirebaseConfig = Boolean(
  apiKey &&
  apiKey.trim().length > 10 &&
  !apiKey.includes('your-api-key') &&
  projectId &&
  projectId.trim().length > 2 &&
  !projectId.includes('your-project-id')
);

export const isFirebaseConfigured: boolean = isValidFirebaseConfig;

/**
 * Creates an unconfigured proxy that throws an informative error if operations are attempted
 * without setting up Firebase environment credentials.
 */
function createUnconfiguredProxy<T extends object>(serviceName: string): T {
  const message = `[Firebase Notice] ${serviceName} is not configured. Please add NEXT_PUBLIC_FIREBASE_* credentials to .env.local.`;
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'then') return undefined;
      return new Proxy(() => {}, {
        apply() {
          throw new Error(message);
        },
        get(_t, subProp) {
          if (subProp === 'then') return undefined;
          return () => {
            throw new Error(message);
          };
        },
      });
    },
  };
  return new Proxy({}, handler) as T;
}

let firebaseApp: FirebaseApp | undefined;
let firebaseAuth: Auth;
let firestoreDb: Firestore;
let firebaseStorageInstance: FirebaseStorage;

if (isFirebaseConfigured) {
  const firebaseConfig = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };

  firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  firebaseAuth = getAuth(firebaseApp);
  firestoreDb = getFirestore(firebaseApp);
  firebaseStorageInstance = getStorage(firebaseApp);
} else {
  firebaseAuth = createUnconfiguredProxy<Auth>('Firebase Auth');
  firestoreDb = createUnconfiguredProxy<Firestore>('Firestore Database');
  firebaseStorageInstance = createUnconfiguredProxy<FirebaseStorage>('Firebase Storage');
}

export const app = firebaseApp;
export const auth = firebaseAuth;
export const db = firestoreDb;
export const storage = firebaseStorageInstance;
