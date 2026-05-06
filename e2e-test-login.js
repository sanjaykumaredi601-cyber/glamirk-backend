import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fetch from 'node-fetch'; // or global fetch if Node 18+
import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });
dotenv.config({ path: '../.env' });

// Initialize standard Firebase client SDK
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

(async () => {
  try {
    console.log('[1/4] Authenticating with Firebase Auth...');
    const userCredential = await signInWithEmailAndPassword(auth, 'superadmin@glamirk.com', 'Admin@123');
    
    console.log('[2/4] Retrieving Firebase ID Token...');
    const token = await userCredential.user.getIdToken();
    console.log('      Token Prefix:', token.substring(0, 20) + '...');
    
    console.log('[3/4] Executing Network Request to Backend /api/admin/login...');
    console.log(`      Authorization: Bearer ${token.substring(0, 10)}...`);

    const res = await fetch('http://localhost:5000/api/admin/login', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({})
    });

    const data = await res.json();
    console.log(`[4/4] Login Response: HTTP ${res.status}`);
    console.log('      Response Data:', JSON.stringify(data, null, 2));

    if (res.status === 200 && data.success) {
      console.log('✅ Admin Login verified!');
      
      const endpoints = ['/all', '/tickets', '/users', '/orders', '/logs', '/me'];
      for (const endpoint of endpoints) {
        console.log(`\n--- Testing ${endpoint} ---`);
        const eRes = await fetch(`http://localhost:5000/api/admin${endpoint}`, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json' 
          }
        });
        console.log(`Response: HTTP ${eRes.status}`);
        const eData = await eRes.json();
        if (eRes.status === 200) {
          console.log(`✅ ${endpoint} success! Items:`, Object.values(eData).find(v => Array.isArray(v))?.length || 'N/A');
        } else {
          console.error(`❌ ${endpoint} failed:`, eData);
        }
      }
    } else {
      console.error('❌ Admin login failed!');
    }

    process.exit(0);
  } catch (error) {
    console.error('Fatal Test Error:', error);
    process.exit(1);
  }
})();
