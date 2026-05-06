import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });
dotenv.config({ path: '../.env' });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function testPersistence() {
  try {
    console.log('[1/4] Logging in as superadmin...');
    const userCredential = await signInWithEmailAndPassword(auth, 'superadmin@glamirk.com', 'Admin@123');
    const token = await userCredential.user.getIdToken();

    const newTitle = "PERSISTENCE TEST " + Date.now();
    console.log(`[2/4] Saving new CMS Hero Title: "${newTitle}"...`);

    const saveRes = await fetch('http://localhost:5000/api/admin/cms/homepage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        hero: {
          banners: [
            { id: 'b1', title: newTitle, url: 'https://example.com/test.jpg' }
          ]
        }
      })
    });

    const saveData = await saveRes.json();
    console.log('      Save Response:', saveData);

    console.log('[3/4] Fetching public CMS data to verify reflection...');
    const fetchRes = await fetch('http://localhost:5000/api/cms');
    const fetchData = await fetchRes.json();

    console.log('[4/4] Verification Result:');
    if (fetchData.homepage?.hero?.banners?.[0]?.title === newTitle) {
      console.log('✅ SUCCESS! CMS updates are reflected instantly via in-memory cache.');
    } else {
      console.log('❌ FAILURE! Expected title:', newTitle);
      console.log('            Actual title:', fetchData.homepage?.hero?.banners?.[0]?.title);
    }

  } catch (err) {
    console.error('Test Error:', err.message);
  }
}

testPersistence();
