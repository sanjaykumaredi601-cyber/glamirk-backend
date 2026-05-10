import express from 'express';
import { admin, db } from '../firebase-admin.js';
import { verifyAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper: Extract storage path from URL
const getStoragePathFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  try {
    // Handle storage.googleapis.com style
    if (url.includes('storage.googleapis.com')) {
      const parts = url.split('/');
      // Skip the domain and bucket name
      const pathParts = parts.slice(4); 
      return decodeURIComponent(pathParts.join('/').split('?')[0]);
    }
    // Handle firebasestorage.googleapis.com style
    if (url.includes('firebasestorage.googleapis.com')) {
      const pathMatch = url.match(/\/o\/(.+?)\?/);
      if (pathMatch) return decodeURIComponent(pathMatch[1]);
    }
    return null;
  } catch (e) {
    return null;
  }
};

// @desc    Delete product and all associated assets (FULL DELETE)
// @route   DELETE /api/admin/products/:id
router.delete('/:id', verifyAuth, requireAdmin('products.delete'), async (req, res) => {
  console.log(`[DELETE] Request received for product ID: ${req.params.id} by ${req.admin.email}`);
  try {
    const productId = req.params.id;
    const docRef = db.collection('products').doc(productId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.warn(`[DELETE] Product ${productId} not found in Firestore.`);
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const product = docSnap.data();
    console.log(`[DELETE] Found product: ${product.name}. Collecting assets...`);
    const urlsToDelete = new Set();

    // 1. Collect all images from the product
    if (product.image) urlsToDelete.add(product.image);
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach(u => urlsToDelete.add(u));
    }

    // 2. Collect all images from shades/variants
    if (product.shades && Array.isArray(product.shades)) {
      product.shades.forEach(shade => {
        if (shade.image) urlsToDelete.add(shade.image);
        if (shade.swatch) urlsToDelete.add(shade.swatch);
        if (shade.images && Array.isArray(shade.images)) {
          shade.images.forEach(u => urlsToDelete.add(u));
        }
        if (shade.mediums && Array.isArray(shade.mediums)) {
          shade.mediums.forEach(u => urlsToDelete.add(u));
        }
        if (shade.thumbnails && Array.isArray(shade.thumbnails)) {
          shade.thumbnails.forEach(u => urlsToDelete.add(u));
        }
      });
    }

    console.log(`[DELETE] Collected ${urlsToDelete.size} unique URLs to remove from storage.`);

    // 3. Delete from Firebase Storage
    const bucket = admin.storage().bucket();
    const deletePromises = Array.from(urlsToDelete)
      .map(url => getStoragePathFromUrl(url))
      .filter(Boolean)
      .map(path => {
        console.log(`[DELETE] Removing storage asset: ${path}`);
        return bucket.file(path).delete().catch(err => {
          console.warn(`[DELETE] Failed to delete storage asset (might be missing): ${path}`, err.message);
        });
      });

    await Promise.allSettled(deletePromises);
    console.log(`[DELETE] Storage cleanup complete.`);

    // 4. Delete the Firestore document
    await docRef.delete();

    // 5. Audit Log the action
    try {
      await db.collection('activityLogs').add({
        action: 'PRODUCT_DELETED',
        details: `Product "${product.name}" fully removed by ${req.admin.email}`,
        message: `Product "${product.name}" fully removed by ${req.admin.email}`, // compat
        type: 'PRODUCT_DELETED',
        targetId: productId,
        adminEmail: req.admin.email,
        adminUid: req.admin.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'server'
      });
    } catch (logErr) {
      console.warn('[DELETE] Logging failed but deletion succeeded:', logErr.message);
    }

    console.log(`[DELETE] Product ${productId} fully removed from Firestore.`);
    res.json({ success: true, message: 'Product and all associated assets deleted successfully' });

  } catch (error) {
    console.error('[DELETE] Critical error during product deletion:', error);
    res.status(500).json({ success: false, error: 'Failed to delete product fully', details: error.message });
  }
});

export default router;
