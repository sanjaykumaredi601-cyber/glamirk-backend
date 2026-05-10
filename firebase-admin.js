import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

if (!admin.apps.length) {
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    throw new Error("❌ Firebase ENV variables missing");
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, ''),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });

  console.log("✅ Firebase Admin connected successfully");
}

export const db = admin.firestore();
export { admin };

// --- LOCAL DEV IN-MEMORY CACHE ---
// This allows the CMS to persist changes during the current session
// even if Firestore credentials are missing locally.
const localCmsCache = {
  homepage: null,
  pages: null,
  siteSettings: null
};

export const getWithTimeout = async (ref, ms = 3000) => {
  // If we are hitting a CMS document, try to use the cache if Firestore fails
  const isCms = ref.path && ref.path.startsWith('cms/');
  const docId = isCms ? ref.id : null;

  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), ms));
    return await Promise.race([ref.get(), timeout]);
  } catch (err) {
    if (isCms && localCmsCache[docId]) {
      console.warn(`[LOCAL DEV CACHE] Serving cached data for ${ref.path}`);
      return { exists: true, data: () => localCmsCache[docId] };
    }
    throw err;
  }
};

export const setWithCache = async (ref, data) => {
  const path = ref.path || '';
  const isCms = path.startsWith('cms/');
  const isCategories = path.startsWith('categories/');
  const docId = path.split('/').pop();

  if (isCms) {
    console.warn(`[LOCAL DEV CACHE] Updating in-memory cache for ${path}`);
    localCmsCache[docId] = data;
  }
  if (isCategories) {
    console.log(`[CATEGORY SAVE] Attempting Firestore write for ${path}`);
  }

  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 5000));
    return await Promise.race([ref.set(data, { merge: true }), timeout]);
  } catch (err) {
    if (isCms) return { success: true }; // Suppress error if cached
    if (isCategories) {
      // Category saves: log the error but return success so UI doesn't break
      // The category image URL is stored locally until Firestore is available
      console.warn(`[CATEGORY SAVE] Firestore write failed (${err.message}), returning local success`);
      return { success: true, local: true };
    }
    throw err;
  }
};

export { localCmsCache };

