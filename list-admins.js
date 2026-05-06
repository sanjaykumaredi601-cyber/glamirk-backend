import { db } from './firebase-client.js';
import { collection, getDocs } from 'firebase/firestore';

async function listAdmins() {
  console.log('Fetching admins from Firestore...');
  try {
    const snapshot = await getDocs(collection(db, 'admins'));
    if (snapshot.empty) {
      console.log('❌ No admins found in "admins" collection.');
    } else {
      console.log(`✅ Found ${snapshot.size} admins:`);
      snapshot.forEach(doc => {
        console.log(`- ID: ${doc.id}`);
        console.log('  Data:', JSON.stringify(doc.data(), null, 2));
      });
    }
  } catch (err) {
    console.error('❌ Error fetching admins:', err.message);
  }
  process.exit(0);
}

listAdmins();
