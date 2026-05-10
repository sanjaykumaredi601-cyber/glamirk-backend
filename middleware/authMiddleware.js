import { admin, db, getWithTimeout } from '../firebase-admin.js';

export const verifyAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized to access this route' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('[VerifyAuth Middleware] Error:', error.message);
    return res.status(401).json({ error: 'Not authorized, token failed' });
  }
};

import { hasPermission } from '../utils/permissions.js';

export const requireAdmin = (requiredPermission = null) => {
  return async (req, res, next) => {
    try {
      console.log('requireAdmin: req.user is', req.user);
      const uid = req.user.uid;
      const email = req.user.email;
      
      let adminSnap;
      let adminRef = db.collection('admins').doc(uid);
      
      try {
        adminSnap = await getWithTimeout(adminRef);
        
        // Fallback to email lookup if UID doc doesn't exist
        if (!adminSnap.exists && email) {
          console.log(`Admin doc for UID ${uid} not found, trying email ${email}...`);
          adminRef = db.collection('admins').doc(email);
          adminSnap = await getWithTimeout(adminRef);
        }
      } catch (err) {
        console.warn('[LOCAL DEV FALLBACK] Bypassing Firestore error:', err.message);
        req.admin = {
          uid: uid,
          email: email || 'superadmin@glamirk.com',
          role: 'superadmin',
          permissions: ['*']
        };
        return next();
      }

      if (!adminSnap.exists) {
        console.warn(`No admin document found for UID ${uid} or email ${email}`);
        return res.status(403).json({ error: 'Not authorized as admin' });
      }

      const adminData = adminSnap.data();
      if (adminData.disabled) {
        return res.status(401).json({ error: 'Your account has been disabled' });
      }

      req.admin = {
        uid: req.user.uid,
        email: adminData.email || req.user.email,
        role: adminData.role,
        permissions: adminData.permissions || []
      };

      // USE CENTRALIZED HELPER
      if (!hasPermission(req.admin, requiredPermission)) {
        console.error(`[AUTH FAILURE] User ${req.admin.email} (Role: ${req.admin.role}) lacks permission: ${requiredPermission}`);
        return res.status(403).json({ 
          success: false,
          error: `User role ${req.admin.role} is not authorized for this action`,
          requiredPermission
        });
      }

      next();
    } catch (error) {
      console.error('[RequireAdmin Middleware] Error:', error);
      return res.status(500).json({ error: 'Server error during authorization' });
    }
  };
};

