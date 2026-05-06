import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import dotenv from 'dotenv';

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Look for .env in the parent directory (root)
const rootEnvPath = path.resolve(__dirname, '../.env');
const rootEnvLocalPath = path.resolve(__dirname, '../.env.local');

dotenv.config({ path: rootEnvLocalPath });
dotenv.config({ path: rootEnvPath });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

console.log('Initializing Firebase Client SDK with Project ID:', firebaseConfig.projectId);
if (!firebaseConfig.apiKey) {
  console.error('CRITICAL: Firebase API Key is missing from environment variables!');
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
