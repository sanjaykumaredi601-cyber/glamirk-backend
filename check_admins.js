import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'glamirk-a2c47'
  });
}

const db = admin.firestore();

async function checkAdmins() {
  const snapshot = await db.collection('admins').get();
  console.log('Admins found:');
  snapshot.forEach(doc => {
    console.log(`- ID: ${doc.id}, Data: ${JSON.stringify(doc.data())}`);
  });
  process.exit(0);
}

checkAdmins();
