const admin = require('firebase-admin');

async function fixAdminDoc() {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: 'glamirk-a2c47'
    });
  }
  const db = admin.firestore();
  const email = 'superadmin@glamirk.com';
  const docRef = db.collection('admins').doc(email);
  
  console.log(`Checking admin doc for ${email}...`);
  const snap = await docRef.get();
  
  if (!snap.exists) {
    console.log('Admin doc missing! Creating...');
    await docRef.set({
      email: email,
      role: 'super_admin',
      name: 'Super Admin',
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Admin doc created.');
  } else {
    console.log('Admin doc exists. Ensuring role is super_admin...');
    await docRef.update({
      role: 'super_admin',
      status: 'active'
    });
    console.log('✅ Admin doc updated.');
  }
  process.exit(0);
}

fixAdminDoc().catch(err => {
  console.error('❌ Error fixing admin doc:', err);
  process.exit(1);
});
