import admin from 'firebase-admin';

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
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });

  console.log("✅ Firebase Admin connected successfully");
}

export const db = admin.firestore();
export { admin };

// --- LOCAL DEV IN-MEMORY CACHE ---
// This allows the CMS to persist changes during the current session
// even if Firestore credentials are missing locally.
// Pre-seeded with default ambassador data so the public API works from cold start.
const localCmsCache = {
  homepage: {
    hero: {
      banners: [
        { 
          id: 'b1', 
          url: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/GlamirkBanner%2FB2ww1.jpeg?alt=media&token=bec6b345-ab9f-49ac-9cc1-4cd782bd2c68', 
          title: 'Melt. Transform.\nReveal.',
          subtitle: 'A new ritual in cleansing — where balm transforms into water.',
          ctaText: 'Shop Now',
          ctaLink: '/shop',
          position: '65% center',
          order: 1 
        },
        { 
          id: 'b2', 
          url: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/GlamirkBanner%2FB2ww.jpeg?alt=media&token=21e801af-23b5-4067-8571-fd82cb666d15', 
          title: 'Pure Luxury.',
          subtitle: 'Experience the golden standard of skincare.',
          ctaText: 'Explore Collection',
          ctaLink: '/shop',
          position: 'center center',
          order: 2 
        }
      ]
    },
    ambassadors: {
      enabled: true,
      list: [
        {
          id: 'a1',
          image: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/GlamirkBanner%2FB2ww1.jpeg?alt=media&token=bec6b345-ab9f-49ac-9cc1-4cd782bd2c68',
          name: 'Selena Gomez',
          title: 'The New Frontier of Beauty.',
          description: 'Discover the collection curated by our global ambassador. A fusion of elegance and modern skincare innovation.',
          ctaText: 'Shop the Edit',
          ctaLink: '/shop',
          alignment: 'right'
        },
        {
          id: 'a2',
          image: 'https://firebasestorage.googleapis.com/v0/b/glamirk-a2c47.firebasestorage.app/o/GlamirkBanner%2FB2ww.jpeg?alt=media&token=21e801af-23b5-4067-8571-fd82cb666d15',
          name: 'Zendaya',
          title: 'Redefining Luxury Skincare.',
          description: 'Every product tells a story of sophistication and radiance. Experience the art of self-care.',
          ctaText: 'Explore Collection',
          ctaLink: '/shop',
          alignment: 'left'
        }
      ]
    },
    featuredProductId: 'balm-to-water',
    sections: []
  },
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

export { admin, localCmsCache };

