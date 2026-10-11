# Firebase Backend Setup Guide for Skillo

Skillo now includes full native support for **Firebase** as its backend provider for **Authentication**, **Database (Firestore)**, and **Cloud Storage (Resumes)**.

---

## 1. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or **Create a project**).
3. Name your project (e.g., `skillo-backend` or `skillo-portal`).
4. (Optional) Disable Google Analytics for faster setup, then click **Create project**.

---

## 2. Register Web App & Get Client Keys

1. In the Firebase Project Overview, click the **Web icon (`</>`)** to add an app.
2. Register app with nickname `Skillo Web`.
3. Firebase will show your `firebaseConfig` object:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "skillo-xxx.firebaseapp.com",
     projectId: "skillo-xxx",
     storageBucket: "skillo-xxx.firebasestorage.app",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
4. Create a `.env.local` file in your Skillo root directory and paste these values:
   ```env
   NEXT_PUBLIC_BACKEND_PROVIDER=firebase
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=skillo-xxx.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=skillo-xxx
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=skillo-xxx.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
   ```

---

## 3. Enable Authentication Providers

1. In the Firebase sidebar, go to **Build** → **Authentication** → **Get started**.
2. Under the **Sign-in method** tab:
   - **Email/Password**: Click enable and click **Save**.
   - **Google**: Click enable, choose your support email, and click **Save**.
     *(Optional)* If testing on `localhost:3000`, Google sign-in works immediately without extra redirect setup.

---

## 4. Create Firestore Database

1. In the sidebar, go to **Build** → **Firestore Database** → **Create database**.
2. Select your nearest database location (e.g. `asia-south1` for Mumbai/India).
3. Choose **Start in production mode**.
4. Go to the **Rules** tab in Firestore and paste the contents of [`firestore.rules`](./firestore.rules), then click **Publish**:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       function isAuthenticated() { return request.auth != null; }
       function isOwner(userId) { return isAuthenticated() && request.auth.uid == userId; }

       match /profiles/{userId} {
         allow read, write: if isOwner(userId);
       }
       match /mock_interviews/{interviewId} {
         allow read: if isAuthenticated() && resource.data.user_id == request.auth.uid;
         allow create: if isAuthenticated() && request.resource.data.user_id == request.auth.uid;
         allow update, delete: if isAuthenticated() && resource.data.user_id == request.auth.uid;
       }
       match /resumes/{resumeId} {
         allow read: if isAuthenticated() && resource.data.user_id == request.auth.uid;
         allow create: if isAuthenticated() && request.resource.data.user_id == request.auth.uid;
         allow delete: if isAuthenticated() && resource.data.user_id == request.auth.uid;
       }
       match /jobs/{jobId} {
         allow read, create: if isAuthenticated();
         allow update, delete: if isAuthenticated() && resource.data.user_id == request.auth.uid;
       }
       match /request_logs/{logId} {
         allow read, create: if isAuthenticated();
       }
     }
   }
   ```

---

## 5. Enable Firebase Storage (for Resumes)

1. In the sidebar, go to **Build** → **Storage** → **Get started**.
2. Click **Next** and **Done**.
3. Go to the **Rules** tab and paste the contents of [`storage.rules`](./storage.rules), then click **Publish**:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /resumes/{userId}/{allPaths=**} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

---

## 6. (Optional) Server Admin SDK

If you want server-side rate-limiting persistence in production:
1. Go to **Project Settings** (gear icon) → **Service accounts**.
2. Click **Generate new private key** (downloads a JSON file).
3. Copy `project_id`, `client_email`, and `private_key` into `.env.local`:
   ```env
   FIREBASE_PROJECT_ID=skillo-xxx
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@skillo-xxx.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
   ```

---

## 7. Verifying the Setup

Restart your Next.js dev server:
```bash
npm run dev
```

Navigate to [http://localhost:3000/login](http://localhost:3000/login) and sign up with a test email. Your user profile will immediately be saved to Firestore, and interviews will persist smoothly!
