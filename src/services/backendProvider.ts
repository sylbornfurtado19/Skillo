export type BackendProvider = 'firebase';

export function getActiveBackendProvider(): BackendProvider {
  return 'firebase';
}

export function isFirebaseActive(): boolean {
  return true;
}

