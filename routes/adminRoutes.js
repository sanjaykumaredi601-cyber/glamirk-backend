import express from 'express';
import { admin, db, getWithTimeout, setWithCache } from '../firebase-admin.js';
import { verifyAuth, requireAdmin } from '../middleware/authMiddleware.js';
import rateLimit from 'express-rate-limit';
import localCategories from '../data/categories.js';
import categoryImageOverrides from '../categoryStore.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many login attempts, please try again after 15 minutes' });
  }
});

// @desc    Admin Login
router.post('/login', loginLimiter, verifyAuth, requireAdmin(), async (req, res) => {
  try {
    const adminRef = db.collection('admins').doc(req.user.uid);
    try {
      await adminRef.update({ 
        failedAttempts: 0, 
        lastLogin: admin.firestore.FieldValue.serverTimestamp() 
      });
    } catch (err) {
      console.warn('[LOCAL DEV FALLBACK] Ignoring update error:', err.message);
    }
    
    // We can clear cookie since we're not using it anymore
    res.clearCookie('admin_token');
    
    res.json({ 
      success: true, 
      user: req.admin 
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Logged out' });
});

router.get('/me', verifyAuth, requireAdmin(), async (req, res) => {
  res.json({ success: true, admin: req.admin });
});

// --- TICKET ENDPOINTS ---

router.get('/tickets', verifyAuth, requireAdmin('tickets.read'), async (req, res) => {
  try {
    const { status, search, priority, assignedTo } = req.query;
    let queryRef = db.collection('tickets').orderBy('createdAt', 'desc');
    
    if (status && status !== 'all') queryRef = queryRef.where('status', '==', status);
    if (priority && priority !== 'all') queryRef = queryRef.where('priority', '==', priority);
    if (assignedTo && assignedTo !== 'all') queryRef = queryRef.where('assignedTo', '==', assignedTo);

    let snapshot;
    try {
      snapshot = await getWithTimeout(queryRef);
    } catch (err) {
      if (err.message.includes('default credentials') || err.message.includes('Missing or insufficient permissions') || err.message.includes('timeout')) {
        return res.json({ success: true, tickets: [] });
      }
      throw err;
    }
    let tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (search) {
      const s = search.toLowerCase();
      tickets = tickets.filter(t => (t.orderId || '').toLowerCase().includes(s) || (t.message || '').toLowerCase().includes(s) || (t.userEmail || '').toLowerCase().includes(s));
    }
    res.json({ success: true, tickets });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

router.get('/tickets/:id', verifyAuth, requireAdmin('tickets.read'), async (req, res) => {
  try {
    const ticketId = req.params.id;
    const ticketRef = db.collection('tickets').doc(ticketId);
    let ticketSnap;
    try {
      ticketSnap = await getWithTimeout(ticketRef);
    } catch (err) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    if (!ticketSnap.exists) return res.status(404).json({ error: 'Ticket not found' });

    const messages = (await getWithTimeout(db.collection('ticket_messages').where('ticketId', '==', ticketId).orderBy('createdAt', 'asc'))).docs.map(d => ({ id: d.id, ...d.data() }));
    const internalNotes = (await getWithTimeout(db.collection('ticket_internal_notes').where('ticketId', '==', ticketId).orderBy('createdAt', 'asc'))).docs.map(d => ({ id: d.id, ...d.data() }));
    const timeline = (await getWithTimeout(db.collection('ticket_timeline').where('ticketId', '==', ticketId).orderBy('createdAt', 'asc'))).docs.map(d => ({ id: d.id, ...d.data() }));

    res.json({ success: true, ticket: { id: ticketSnap.id, ...ticketSnap.data() }, messages, internalNotes, timeline });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

router.post('/tickets/:id/message', verifyAuth, requireAdmin('tickets.update'), async (req, res) => {
  try {
    const { message, isInternal } = req.body;
    const ticketId = req.params.id;
    const io = req.app.get('io');
    if (!message) return res.status(400).json({ error: 'Required' });

    const collectionName = isInternal ? 'ticket_internal_notes' : 'ticket_messages';
    const newMessage = { ticketId, message, senderRole: 'admin', senderEmail: req.admin.email, createdAt: admin.firestore.FieldValue.serverTimestamp() };
    const docRef = await db.collection(collectionName).add(newMessage);
    
    const updates = { lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (!isInternal) updates.status = 'open';
    await db.collection('tickets').doc(ticketId).update(updates);

    if (!isInternal) io.to(ticketId).emit('new_message', { ...newMessage, id: docRef.id });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

router.patch('/tickets/:id', verifyAuth, requireAdmin('tickets.update'), async (req, res) => {
  try {
    const updates = { ...req.body, lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (updates.status === 'resolved') updates.resolvedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('tickets').doc(req.params.id).update(updates);
    await db.collection('ticket_timeline').add({ ticketId: req.params.id, event: `Update: ${Object.keys(req.body).join(', ')}`, performedBy: req.admin.email, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// --- USER MGMT ENDPOINTS ---

router.get('/orders', verifyAuth, requireAdmin('orders.read'), async (req, res) => {
  try {
    let snapshot;
    try {
      snapshot = await getWithTimeout(db.collection('orders').orderBy('createdAt', 'desc').limit(300));
    } catch (err) {
      if (err.message.includes('default credentials') || err.message.includes('Missing or insufficient permissions') || err.message.includes('timeout')) {
        return res.json({ success: true, orders: [] });
      }
      throw err;
    }
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/logs', verifyAuth, requireAdmin(), async (req, res) => {
  try {
    let snapshot;
    try {
      snapshot = await getWithTimeout(db.collection('activityLogs').orderBy('createdAt', 'desc').limit(10));
    } catch (err) {
      if (err.message.includes('default credentials') || err.message.includes('Missing or insufficient permissions') || err.message.includes('timeout')) {
        return res.json({ success: true, logs: [] });
      }
      throw err;
    }
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

router.get('/users', verifyAuth, requireAdmin('users.read'), async (req, res) => {
  try {
    let snapshot;
    try {
      snapshot = await getWithTimeout(db.collection('users'));
    } catch (err) {
      if (err.message.includes('default credentials') || err.message.includes('Missing or insufficient permissions') || err.message.includes('timeout')) {
        return res.json({ success: true, users: [] });
      }
      throw err;
    }
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// --- CMS ENDPOINTS ---

router.get('/cms', verifyAuth, requireAdmin('cms.read'), async (req, res) => {
  try {
    let homeSnap, pagesSnap, settingsSnap;
    try {
      [homeSnap, pagesSnap, settingsSnap] = await Promise.all([
        getWithTimeout(db.collection('cms').doc('homepage')),
        getWithTimeout(db.collection('cms').doc('pages')),
        getWithTimeout(db.collection('cms').doc('siteSettings'))
      ]);
    } catch (err) {
      if (err.message.includes('default credentials') || err.message.includes('Missing or insufficient permissions') || err.message.includes('timeout')) {
        console.warn('[LOCAL DEV FALLBACK] Bypassing Firestore for /cms data');
        return res.json({
          success: true,
          data: { homepage: null, pages: null, siteSettings: null }
        });
      }
      throw err;
    }

    res.json({
      success: true,
      data: {
        homepage: homeSnap.exists ? homeSnap.data() : null,
        pages: pagesSnap.exists ? pagesSnap.data() : null,
        siteSettings: settingsSnap.exists ? settingsSnap.data() : null
      }
    });
  } catch (error) {
    console.error('CMS Fetch Error:', error);
    res.status(500).json({ error: 'Failed to fetch CMS data' });
  }
});

router.post('/cms/:type', verifyAuth, requireAdmin('cms.update'), async (req, res) => {
  try {
    const { type } = req.params; // 'homepage' | 'pages' | 'siteSettings'
    const data = req.body;

    if (!['homepage', 'pages', 'siteSettings'].includes(type)) {
      return res.status(400).json({ error: 'Invalid CMS type' });
    }

    try {
      await setWithCache(db.collection('cms').doc(type), {
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      if (err.message.includes('default credentials') || err.message.includes('Missing or insufficient permissions') || err.message.includes('timeout')) {
        console.warn('[LOCAL DEV FALLBACK] CMS save suppressed (cached)');
        return res.json({ success: true, message: `CMS ${type} updated locally (Cached)` });
      }
      throw err;
    }

    res.json({ success: true, message: `CMS ${type} updated successfully` });
  } catch (error) {
    console.error('CMS Save Error:', error);
    res.status(500).json({ error: 'Failed to save CMS data' });
  }
});

// Category Management Routes
router.get('/cms/categories', verifyAuth, requireAdmin('cms.read'), async (req, res) => {
  try {
    let snapshot = await getWithTimeout(db.collection('categories').orderBy('order', 'asc'));
    
    // Only seed if document is completely missing
    for (const cat of localCategories) {
      const docRef = db.collection('categories').doc(cat.slug);
      const doc = await docRef.get();
      if (!doc.exists) {
        console.log(`[CMS] Seeding missing category: ${cat.slug}`);
        await docRef.set({ ...cat, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
    snapshot = await getWithTimeout(db.collection('categories').orderBy('order', 'asc'));

    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, categories });
  } catch (error) {
    console.warn('[ADMIN] Categories fetch failed, serving local fallback');
    res.json({ success: true, categories: localCategories }); 
  }
});

router.post('/cms/categories/:id', verifyAuth, requireAdmin('cms.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (!id) return res.status(400).json({ error: 'Category ID required' });

    console.log(`[CATEGORY SAVE] Saving category: ${id}`, Object.keys(data));

    // ─── Update in-memory store IMMEDIATELY ───────────────────────────────────
    // This ensures /api/categories returns the new image even if Firestore fails
    if (data.image !== undefined) {
      if (data.image) {
        categoryImageOverrides[id] = data.image;
        console.log(`[CATEGORY STORE] Image override set for '${id}': ${data.image.substring(0, 60)}...`);
      } else {
        delete categoryImageOverrides[id]; // Removed image — clear override
      }
    }

    const result = await setWithCache(db.collection('categories').doc(id), {
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ 
      success: true, 
      message: result?.local ? 'Category updated locally (Firestore sync pending)' : 'Category updated successfully',
      local: result?.local || false
    });
  } catch (error) {
    console.error('[CATEGORY SAVE] Error:', error.message);
    if (error.message.includes('default credentials') || error.message.includes('Missing or insufficient permissions')) {
      return res.json({ success: true, message: 'Category saved (auth fallback)', local: true });
    }
    res.status(500).json({ error: `Failed to update category: ${error.message}` });
  }
});

router.get('/all', verifyAuth, requireAdmin('admins.manage'), async (req, res) => {
  try {
    let snapshot;
    try {
      snapshot = await getWithTimeout(db.collection('admins'));
    } catch (err) {
      if (err.message.includes('default credentials') || err.message.includes('Missing or insufficient permissions') || err.message.includes('timeout')) {
        console.warn('[LOCAL DEV FALLBACK] Bypassing Firestore for /all admins');
        return res.json({ success: true, admins: [{ email: req.admin.email, role: req.admin.role, permissions: req.admin.permissions }] });
      }
      throw err;
    }
    res.json({ success: true, admins: snapshot.docs.map(d => { const data = d.data(); delete data.password; return data; }) });
  } catch (error) { 
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admins' }); 
  }
});

// @desc    Create new admin
router.post('/create', verifyAuth, requireAdmin('admins.manage'), async (req, res) => {
  try {
    const { email, password, role, permissions } = req.body;
    
    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password and role are required' });
    }

    // 1. Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      emailVerified: true
    });

    // 2. Create admin document in Firestore
    const adminData = {
      uid: userRecord.uid,
      email: email.toLowerCase(),
      role: role === 'super_admin' ? 'super_admin' : 'admin',
      permissions: role === 'super_admin' ? ['*'] : (permissions || []),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('admins').doc(userRecord.uid).set(adminData);
    
    res.json({ success: true, message: 'Admin created successfully' });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ error: error.message || 'Failed to create admin' });
  }
});

// @desc    Update admin role/permissions
router.put('/update/:email', verifyAuth, requireAdmin('admins.manage'), async (req, res) => {
  try {
    const { email } = req.params;
    const { role, permissions } = req.body;

    const snapshot = await db.collection('admins').where('email', '==', email.toLowerCase()).get();
    if (snapshot.empty) return res.status(404).json({ error: 'Admin not found' });

    const adminDoc = snapshot.docs[0];
    const updates = {
      role: role === 'super_admin' ? 'super_admin' : 'admin',
      permissions: role === 'super_admin' ? ['*'] : (permissions || []),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await adminDoc.ref.update(updates);
    res.json({ success: true, message: 'Admin updated successfully' });
  } catch (error) {
    console.error('Error updating admin:', error);
    res.status(500).json({ error: 'Failed to update admin' });
  }
});

// @desc    Remove admin
router.delete('/:email', verifyAuth, requireAdmin('admins.manage'), async (req, res) => {
  try {
    const { email } = req.params;
    
    // Prevent self-deletion if needed (logic can be added here)
    
    const snapshot = await db.collection('admins').where('email', '==', email.toLowerCase()).get();
    if (snapshot.empty) return res.status(404).json({ error: 'Admin not found' });

    const adminDoc = snapshot.docs[0];
    const uid = adminDoc.data().uid;

    // 1. Delete from Firebase Auth
    try {
      await admin.auth().deleteUser(uid);
    } catch (e) {
      console.warn('Auth user deletion failed (may already be deleted):', e.message);
    }

    // 2. Delete Firestore doc
    await adminDoc.ref.delete();
    
    res.json({ success: true, message: 'Admin removed successfully' });
  } catch (error) {
    console.error('Error removing admin:', error);
    res.status(500).json({ error: 'Failed to remove admin' });
  }
});

export default router;
