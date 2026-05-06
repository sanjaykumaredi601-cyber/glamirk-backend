import { db } from '../firebase-client.js';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import bcrypt from 'bcryptjs';

const reset = async () => {
  const email = 'admin@glamirk.com';
  const password = 'Admin@123';
  const hashedPassword = await bcrypt.hash(password, 12);
  
  await setDoc(doc(db, 'admins', email), {
    email,
    password: hashedPassword,
    role: 'super_admin',
    permissions: ['*'],
    forcePasswordChange: false,
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: serverTimestamp()
  }, { merge: true });
  
  console.log(`Admin ${email} reset successfully with password: ${password}`);
  process.exit(0);
};

reset();
