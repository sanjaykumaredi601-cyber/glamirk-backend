// Uses the Firebase Client SDK (same as frontend) to write ambassador data
// This bypasses the Admin SDK credential issue

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

console.log('Firebase Config:', { projectId: firebaseConfig.projectId });

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const seedAmbassadors = async () => {
  try {
    const homepageRef = doc(db, 'cms', 'homepage');
    
    await setDoc(homepageRef, {
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
      updatedAt: serverTimestamp()
    }, { merge: true });

    console.log('✅ Successfully seeded 2 ambassadors with real Firebase Storage images!');
    console.log('Ambassador 1: Selena Gomez - using B2ww1.jpeg');
    console.log('Ambassador 2: Zendaya - using B2ww.jpeg');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed ambassadors:', error.message);
    process.exit(1);
  }
};

seedAmbassadors();
