import { admin, db } from './firebase-admin.js';

const seedUidAdmin = async () => {
  try {
    const email = 'masteradmin@glamirk.com';
    const password = 'Admin@123';
    
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log('User already exists in Auth, using existing UID:', userRecord.uid);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        userRecord = await admin.auth().createUser({
          email,
          password,
          emailVerified: true
        });
        console.log('Created new user in Auth with UID:', userRecord.uid);
      } else {
        throw e;
      }
    }

    await db.collection('admins').doc(userRecord.uid).set({
      email,
      role: 'super_admin',
      permissions: ['*'],
      disabled: false
    });

    console.log(`Successfully seeded admin doc for ${email} with UID ${userRecord.uid}!`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed admin:', error);
    process.exit(1);
  }
};

seedUidAdmin();
