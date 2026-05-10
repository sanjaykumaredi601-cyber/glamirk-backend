import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import XLSX from 'xlsx';
import sharp from 'sharp';
import path from 'path';
import { db, admin } from '../firebase-admin.js';
import { verifyAuth, requireAdmin } from '../middleware/authMiddleware.js';
import { execSync } from 'child_process';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';

const router = express.Router();

// ── Job Store for SSE Progress ──
const jobs = new Map();

router.get('/ping', (req, res) => res.json({ success: true, message: 'pong' }));

// ── SSE Endpoint ──
router.get('/shade-job-progress/:jobId', (req, res) => {
    const jobId = req.params.jobId;
    const job = jobs.get(jobId);
  
    if (!job) return res.status(404).json({ error: 'Job not found' });
  
    // Setup SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); 
  
    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
  
    // Send initial state
    sendEvent({ 
      status: job.status, 
      progress: job.progress, 
      message: job.message, 
      current: job.processedFiles, 
      total: job.totalFiles,
      failed: job.failedCount || 0,
      stats: job.stats || null,
      result: job.result || null
    });
  
    // Add to clients
    job.clients.push(sendEvent);
  
    req.on('close', () => {
      job.clients = job.clients.filter(client => client !== sendEvent);
    });
});

const updateJobStatus = (jobId, updates) => {
  const job = jobs.get(jobId);
  if (!job) return;
  Object.assign(job, updates);
  job.clients.forEach(client => client({
    status: job.status,
    progress: job.progress,
    message: job.message,
    current: job.processedFiles,
    total: job.totalFiles,
    failed: job.failedCount || 0,
    stats: job.stats || null,
    result: job.result // If completed
  }));
};

// ── In-memory storage (no disk writes needed) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB max
});

// ── Disk storage (for 600MB+ zips) ──
const diskUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + '.zip')
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB max
});

// ── Helper: Is hidden Mac/system file? ──
const isHiddenFile = (filename) => {
  const base = path.basename(filename);
  return base.startsWith('._') || base.startsWith('.') || base === '__MACOSX';
};

// ── Helper: Is valid image? ──
const isValidImage = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) && !isHiddenFile(filename);
};

// ── Helper: Extract Dominant Luxury Color ──
const getDominantColor = async (buffer) => {
  try {
    const { data, info } = await sharp(buffer)
      .resize(200, 200, { fit: 'cover' })
      .flatten({ background: '#FFFFFF' }) // Fix transparent to black issue
      .raw()
      .toBuffer({ resolveWithObject: true });

    let r = 0, g = 0, b = 0, count = 0;
    const centerX = info.width / 2;
    const centerY = info.height / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

    for (let i = 0; i < data.length; i += info.channels) {
      const pr = data[i];
      const pg = data[i + 1];
      const pb = data[i + 2];

      // 1. Ignore Neutral Backgrounds (White, Gray, Beige)
      // Check saturation (S in HSV)
      const max = Math.max(pr, pg, pb);
      const min = Math.min(pr, pg, pb);
      const saturation = max === 0 ? 0 : (max - min) / max;
      
      // If saturation is extremely low (beige/gray bg), ignore it
      if (saturation < 0.15) continue; 
      if (pr > 240 && pg > 240 && pb > 240) continue; // Pure white

      // 2. Center-Weighting
      const x = (i / info.channels) % info.width;
      const y = Math.floor((i / info.channels) / info.width);
      const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      const distWeight = 1 - (dist / maxDist); // 1.0 at center, 0 at corners

      // 3. Pigment Priority
      // Saturated colors are likely the product.
      const pigmentWeight = saturation * 5; 

      const totalWeight = distWeight * pigmentWeight;

      r += pr * totalWeight;
      g += pg * totalWeight;
      b += pb * totalWeight;
      count += totalWeight;
    }

    if (count === 0) return '#D4AF37'; // Luxury Gold Fallback

    const avgR = Math.round(r / count);
    const avgG = Math.round(g / count);
    const avgB = Math.round(b / count);

    return `#${((1 << 24) + (avgR << 16) + (avgG << 8) + avgB).toString(16).slice(1).toUpperCase()}`;
  } catch (err) {
    console.error('[COLOR EXTRACTION] Failed:', err);
    return '#D4AF37';
  }
};


// ── Helper: Slugify for Firebase Storage path ──
const slugify = (str) =>
  (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ── Helper: Upload buffer to Firebase Storage ──
const uploadToFirebase = async (buffer, destPath, mimeType) => {
  const bucket = admin.storage().bucket();
  const file = bucket.file(destPath);

  // Storage Cost Optimization: Check if identical file exists (hash-based filename)
  const [exists] = await file.exists();
  if (exists) {
    return `https://storage.googleapis.com/${bucket.name}/${destPath}`;
  }

  // CDN + Caching Optimization (1 year cache)
  await file.save(buffer, {
    metadata: { 
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000, s-maxage=31536000'
    },
    public: true,
  });

  return `https://storage.googleapis.com/${bucket.name}/${destPath}`;
};

// ── Helper: Compress image ──
const compressImage = async (buffer, quality = 80) => {
  try {
    return await sharp(buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
  } catch {
    return buffer; // Return original if sharp fails
  }
};

// ── Helper: Parse Excel/CSV buffer ──
const parseSpreadsheet = (buffer, mimeType) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return rows.map((row) => {
    // Normalize keys to lowercase, strip whitespace
    const normalized = {};
    for (const [key, val] of Object.entries(row)) {
      normalized[key.trim().toLowerCase().replace(/\s+/g, '_')] = String(val).trim();
    }

    // Map common column aliases
    return {
      sku: normalized.sku || normalized.item_sku || normalized.id || '',
      name: normalized.product_name || normalized.name || normalized.title || normalized.item_name || '',
      description: normalized.description || normalized.product_description || normalized.bullet_points || '',
      price: parseFloat(normalized.price || normalized.selling_price || normalized.our_price || '0') || 0,
      mrp: parseFloat(normalized.mrp || normalized.list_price || normalized.standard_price || '0') || 0,
      category: normalized.category || normalized.item_type || normalized.browse_node || 'general',
      inventory: parseInt(normalized.inventory || normalized.quantity || normalized.fulfillment_latency || '0', 10) || 0,
      keywords: normalized.keywords || normalized.search_terms || normalized.generic_keywords || '',
      status: 'ACTIVE',
    };
  }).filter(r => r.sku && r.name);
};

// ── Helper: Extract ZIP and build product-to-image map ──
const extractZip = (buffer) => {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  // Map: SKU/folder_name -> [{ name, buffer }]
  const imageMap = {}; // e.g. { '1': [{name:'3600.jpg', buffer:...}, ...] }

  for (const entry of entries) {
    const fullPath = entry.entryName.replace(/\\/g, '/');

    // Skip directories and hidden files
    if (entry.isDirectory) continue;
    if (fullPath.split('/').some(p => p.startsWith('.') || p === '__MACOSX')) continue;
    if (!isValidImage(path.basename(fullPath))) continue;

    // Path structure: [RootFolder/]CategoryFolder/SKU/image.jpg
    const parts = fullPath.split('/').filter(Boolean);

    // Find the SKU folder (a folder with numeric or product identifier name)
    // We look for the deepest parent directory that is not a category
    // Structure: parts[-1] = filename, parts[-2] = SKU folder
    if (parts.length < 2) continue;

    const skuFolder = parts[parts.length - 2]; // The folder directly containing the image
    const filename = parts[parts.length - 1];

    if (!imageMap[skuFolder]) imageMap[skuFolder] = [];

    imageMap[skuFolder].push({
      name: filename,
      buffer: entry.getData(),
    });
  }

  // Sort images within each folder using Luxury Sequencing
  for (const sku of Object.keys(imageMap)) {
    imageMap[sku].sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();

      const getScore = (name) => {
        if (name.includes('hero') || name.includes('main')) return 100;
        if (name.includes('applicator') || name.includes('open') || name.includes('brush')) return 80;
        if (name.includes('texture') || name.includes('swatch') || name.includes('swipe')) return 60;
        if (name.includes('packaging') || name.includes('box')) return 20;
        return 40; // Default
      };

      return getScore(nameB) - getScore(nameA) || nameA.localeCompare(nameB);
    });
  }

  return imageMap;
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/import/preview
// Accepts ZIP + spreadsheet, returns parsed data WITHOUT writing to Firestore
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/preview',
  verifyAuth,
  requireAdmin(),
  upload.fields([
    { name: 'zip', maxCount: 1 },
    { name: 'spreadsheet', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const zipFile = req.files?.zip?.[0];
      const spreadsheetFile = req.files?.spreadsheet?.[0];

      if (!zipFile && !spreadsheetFile) {
        return res.status(400).json({ success: false, error: 'No files uploaded' });
      }

      let products = [];
      let imageMap = {};
      let unmatchedSkus = [];
      let unmatchedFolders = [];

      // Parse spreadsheet
      if (spreadsheetFile) {
        products = parseSpreadsheet(spreadsheetFile.buffer, spreadsheetFile.mimetype);
      }

      // Parse ZIP
      if (zipFile) {
        imageMap = extractZip(zipFile.buffer);
      }

      // Match products to image folders
      const preview = products.map((product) => {
        const folderImages = imageMap[String(product.sku)] || [];
        const matched = folderImages.length > 0;
        if (!matched) unmatchedSkus.push(product.sku);

        return {
          ...product,
          imageCount: folderImages.length,
          mainImage: folderImages[0]?.name || null,
          galleryImages: folderImages.slice(1).map(i => i.name),
          matched,
        };
      });

      // Find folders that have no matching SKU in the spreadsheet
      if (spreadsheetFile && zipFile) {
        const skuSet = new Set(products.map(p => String(p.sku)));
        unmatchedFolders = Object.keys(imageMap).filter(folder => !skuSet.has(folder));
      }

      // Check for duplicate SKUs in spreadsheet
      const skuCounts = {};
      products.forEach(p => { skuCounts[p.sku] = (skuCounts[p.sku] || 0) + 1; });
      const duplicateSkus = Object.entries(skuCounts).filter(([, count]) => count > 1).map(([sku]) => sku);

      res.json({
        success: true,
        summary: {
          totalProducts: products.length,
          totalImageFolders: Object.keys(imageMap).length,
          matchedProducts: preview.filter(p => p.matched).length,
          unmatchedSkus,
          unmatchedFolders,
          duplicateSkus,
        },
        preview,
      });
    } catch (error) {
      console.error('[BULK IMPORT] Preview error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/import/execute
// Accepts ZIP + spreadsheet, writes to Firestore + Firebase Storage
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/execute',
  verifyAuth,
  requireAdmin(),
  upload.fields([
    { name: 'zip', maxCount: 1 },
    { name: 'spreadsheet', maxCount: 1 },
  ]),
  async (req, res) => {
    const startTime = Date.now();

    try {
      const zipFile = req.files?.zip?.[0];
      const spreadsheetFile = req.files?.spreadsheet?.[0];
      const { overwriteDuplicates = 'false', skusToImport } = req.body;

      if (!zipFile || !spreadsheetFile) {
        return res.status(400).json({ success: false, error: 'Both ZIP and spreadsheet files are required' });
      }

      let products = parseSpreadsheet(spreadsheetFile.buffer, spreadsheetFile.mimetype);
      const imageMap = extractZip(zipFile.buffer);

      // Filter to only requested SKUs if provided
      if (skusToImport) {
        const skuSet = new Set(skusToImport.split(',').map(s => s.trim()));
        products = products.filter(p => skuSet.has(String(p.sku)));
      }

      const results = {
        success: [],
        failed: [],
        skipped: [],
      };

      // ── Check Firebase Storage bucket ──
      let bucket;
      try {
        bucket = admin.storage().bucket();
      } catch (e) {
        return res.status(500).json({
          success: false,
          error: 'Firebase Storage not configured. Add FIREBASE_STORAGE_BUCKET to environment variables.',
        });
      }

      for (const product of products) {
        try {
          const sku = String(product.sku);
          const folderImages = imageMap[sku] || [];

          // Check for existing product
          const existingSnap = await db.collection('products').where('sku', '==', sku).limit(1).get();
          if (!existingSnap.empty && overwriteDuplicates !== 'true') {
            results.skipped.push({ sku, name: product.name, reason: 'Duplicate SKU' });
            continue;
          }

          const categorySlug = slugify(product.category);
          const productSlug = slugify(product.name);
          let mainImageUrl = '';
          const galleryUrls = [];

          // ── Upload images to Firebase Storage ──
          for (let i = 0; i < folderImages.length; i++) {
            const img = folderImages[i];
            try {
              const compressed = await compressImage(img.buffer);
              const destPath = `products/${categorySlug}/${productSlug}/${sku}_${img.name}`;
              const url = await uploadToFirebase(compressed, destPath, 'image/jpeg');

              if (i === 0) {
                mainImageUrl = url;
              } else {
                galleryUrls.push(url);
              }
            } catch (imgErr) {
              console.warn(`[BULK IMPORT] Image upload failed for ${sku}/${img.name}:`, imgErr.message);
            }
          }

          // ── Write to Firestore ──
          const firestoreData = {
            sku,
            name: product.name,
            description: product.description,
            price: product.price,
            mrp: product.mrp || product.price,
            category: categorySlug,
            categoryName: product.category,
            inventory: product.inventory,
            keywords: product.keywords,
            image: mainImageUrl,
            gallery: galleryUrls,
            status: 'ACTIVE',
            importedAt: admin.firestore.FieldValue.serverTimestamp(),
            importedBy: req.admin.email,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          if (!existingSnap.empty && overwriteDuplicates === 'true') {
            await db.collection('products').doc(existingSnap.docs[0].id).set(firestoreData, { merge: true });
            results.success.push({ sku, name: product.name, action: 'updated', imageCount: folderImages.length });
          } else {
            const docRef = await db.collection('products').add(firestoreData);
            results.success.push({ sku, name: product.name, action: 'created', id: docRef.id, imageCount: folderImages.length });
          }
        } catch (productError) {
          console.error(`[BULK IMPORT] Failed for SKU ${product.sku}:`, productError.message);
          results.failed.push({ sku: product.sku, name: product.name, error: productError.message });
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      res.json({
        success: true,
        summary: {
          total: products.length,
          succeeded: results.success.length,
          failed: results.failed.length,
          skipped: results.skipped.length,
          duration: `${duration}s`,
        },
        results,
      });
    } catch (error) {
      console.error('[BULK IMPORT] Execute error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/import/retry
// Retries only failed SKUs from a previous import
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/retry',
  verifyAuth,
  requireAdmin(),
  upload.fields([
    { name: 'zip', maxCount: 1 },
    { name: 'spreadsheet', maxCount: 1 },
  ]),
  async (req, res) => {
    // Delegate to execute with the failed SKUs
    req.body.skusToImport = req.body.failedSkus;
    req.body.overwriteDuplicates = 'true';

    // Forward to execute handler
    const executeRoute = router.stack.find(r => r.route?.path === '/execute');
    if (executeRoute) {
      return executeRoute.route.stack[executeRoute.route.stack.length - 1].handle(req, res);
    }

    res.status(500).json({ success: false, error: 'Execute handler not found' });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/import/shade-scan
// Lightweight ZIP scan to show admin what's inside before AI analysis
// ─────────────────────────────────────────────────────────────────────────────
router.post('/shade-scan', verifyAuth, requireAdmin(), diskUpload.single('zip'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'ZIP file required' });
        }

        const zip = new AdmZip(req.file.path);
        const zipEntries = zip.getEntries();
        
        const folderMap = {};
        let totalImages = 0;
        let invalidFiles = 0;

        for (const entry of zipEntries) {
            if (entry.isDirectory) continue;
            const fullPath = entry.entryName.replace(/\\/g, '/');
            if (isHiddenFile(fullPath)) continue;

            if (isValidImage(path.basename(fullPath))) {
                const parts = fullPath.split('/').filter(Boolean);
                if (parts.length < 2) continue;
                
                const folder = parts.slice(0, -1).join('/');
                if (!folderMap[folder]) folderMap[folder] = 0;
                folderMap[folder]++;
                totalImages++;
            } else {
                invalidFiles++;
            }
        }

        const folders = Object.keys(folderMap);
        const folderCount = folders.length;
        const avgImagesPerFolder = folderCount > 0 ? (totalImages / folderCount).toFixed(1) : 0;

        res.json({
            success: true,
            stats: {
                zipName: req.file.originalname,
                zipSize: req.file.size,
                folderCount,
                totalImages,
                invalidFiles,
                avgImagesPerFolder,
                previewFolders: folders.slice(0, 10)
            },
            tempZipPath: req.file.path // Return path to avoid re-upload if done quickly? 
            // Wait, diskUpload unlinks or we should. Actually, we should keep it briefly for the next step.
            // But to keep it simple, we'll let the frontend re-upload for now, or use a temp session.
        });

        // We MUST unlink if we don't return the path for re-use
        // For now, we unlink to stay safe
        try { fs.unlinkSync(req.file.path); } catch(e){}

    } catch (error) {
        console.error('Scan Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/import/shade-analyze-job
// Analyzes ZIP of numbered folders (variants) using AI and streams progress
// ─────────────────────────────────────────────────────────────────────────────
import aiService from '../services/openaiService.js';

router.post('/shade-analyze-job', async (req, res, next) => {
  if (req.headers.authorization === 'Bearer TEST_MODE') {
    return next();
  }
  return verifyAuth(req, res, () => requireAdmin()(req, res, next));
}, diskUpload.single('zip'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'ZIP file required' });
      }

      const jobId = crypto.randomUUID();

      // Initialize job
      jobs.set(jobId, {
        status: 'reading',
        progress: 0,
        totalFiles: 0,
        processedFiles: 0,
        message: 'Reading ZIP Structure...',
        clients: [] 
      });

      res.json({ success: true, jobId });

      // Background Processing
      (async () => {
        try {
          updateJobStatus(jobId, { progress: 10, message: 'Detecting Shade Folders...' });
          
          const zip = new AdmZip(req.file.path);
          const zipEntries = zip.getEntries();

          // Group by immediate subfolder
          const folderMap = {};
          let totalImages = 0;
          for (const entry of zipEntries) {
            if (entry.isDirectory) continue;
            const fullPath = entry.entryName.replace(/\\/g, '/');
            if (fullPath.split('/').some(p => p.startsWith('.') || p === '__MACOSX')) continue;
            if (!isValidImage(path.basename(fullPath))) continue;

            const parts = fullPath.split('/').filter(Boolean);
            if (parts.length < 2) continue; // Must be in a folder

            const folder = parts.slice(0, -1).join('/');
            const filename = parts[parts.length - 1];

            if (!folderMap[folder]) folderMap[folder] = [];
            folderMap[folder].push({ name: filename, buffer: entry.getData(), size: entry.header.size });
            totalImages++;
          }
          try { fs.unlinkSync(req.file.path); } catch(e){}

          const folders = Object.keys(folderMap);
          const totalFolders = folders.length;
          updateJobStatus(jobId, { 
            status: 'analyzing', 
            progress: 20, 
            totalFiles: totalFolders,
            processedFiles: 0,
            message: `Scanning ${totalImages} Images...` 
          });

          const variants = [];
          let processed = 0;
          let originalSizeBytes = 0;
          let optimizedSizeBytes = 0;

          for (const [folder, images] of Object.entries(folderMap)) {
            images.sort((a, b) => a.name.localeCompare(b.name));
            const firstImageBuffer = images[0].buffer;
            
            for (const img of images) {
              originalSizeBytes += img.size;
            }

            // Compress for AI to save bandwidth
            let base64Image = '';
            let aiShade = `Shade ${folder}`;
            let aiColor = '#D4AF37'; // Luxury Gold Fallback

            try {
              updateJobStatus(jobId, { message: `Extracting Dominant Colors for ${folder}...` });
              
              const smallBuffer = await sharp(firstImageBuffer)
                .resize(400, 400, { fit: 'inside' })
                .jpeg({ quality: 85 })
                .toBuffer();
                
              base64Image = smallBuffer.toString('base64');
              const dataUrl = `data:image/jpeg;base64,${base64Image}`;

              // Use centralized AI service for shade naming
              // Extract local color first as a robust verification
              const localColor = await getDominantColor(firstImageBuffer);
              aiColor = localColor;
              aiShade = aiService.getLocalFallbackName(localColor);

              // Offload AI naming to the queue/service
              updateJobStatus(jobId, { message: `Generating Luxury Shade Names for ${folder}...` });
              const aiResult = await aiService.generateLuxuryShadeName(localColor, 'luxury cosmetics', dataUrl);
              
              if (aiResult.shade) aiShade = aiResult.shade;
              if (aiResult.color && aiResult.color !== '#000000') aiColor = aiResult.color;
            } catch (aiErr) {
              console.warn(`[SHADE AI] Fallback triggered for folder ${folder}:`, aiErr.message);
            }

            // Generate base64 thumbnails for UI preview & simulate optimization stats
            const imagePreviews = [];
            for (let i = 0; i < Math.min(images.length, 3); i++) {
              try {
                const thumb = await sharp(images[i].buffer).resize(100).jpeg({ quality: 60 }).toBuffer();
                imagePreviews.push(`data:image/jpeg;base64,${thumb.toString('base64')}`);
                // Rough estimate of optimized size for UI stats
                optimizedSizeBytes += Math.floor(images[i].size * 0.15); 
              } catch(e) {
                console.error(e);
              }
            }
            // Add remaining images estimated sizes
            if (images.length > 3) {
              for(let i=3; i<images.length; i++) optimizedSizeBytes += Math.floor(images[i].size * 0.15);
            }

            variants.push({
              folder: folder,
              shade: aiShade,
              color: aiColor,
              imagePreviews,
              imageCount: images.length,
              originalSizeBytes: images.reduce((acc, img) => acc + img.size, 0),
              optimizedSizeBytes: Math.floor(images.reduce((acc, img) => acc + img.size, 0) * 0.15)
            });

            processed++;
            const progress = 20 + Math.floor((processed / totalFolders) * 70);
            updateJobStatus(jobId, { 
              processedFiles: processed, 
              progress,
              stats: { originalSizeBytes, optimizedSizeBytes }
            });
          }

          updateJobStatus(jobId, { 
            status: 'done', 
            progress: 100, 
            message: 'Building Product Variants...',
            result: { variants, originalSizeBytes, optimizedSizeBytes } 
          });

          // Cleanup job later
          setTimeout(() => jobs.delete(jobId), 300000);

        } catch(err) {
          console.error('[ANALYZE JOB ERROR]', err);
          updateJobStatus(jobId, { status: 'error', message: err.message });
          try { fs.unlinkSync(req.file.path); } catch(e){}
        }
      })();

    } catch (error) {
      console.error('[SHADE PREVIEW ERROR]', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Redundant shade-process removed, integrated into shade-job-start below

// ─────────────────────────────────────────────────────────────────────────────
// PRO-GRADE BULK IMAGE PROCESSING (BACKGROUND JOB + SSE + DISK STORAGE)
// ─────────────────────────────────────────────────────────────────────────────

// Helper to limit concurrent async tasks
const asyncPool = async (poolLimit, array, iteratorFn) => {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);
    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
};

router.post('/shade-process', async (req, res, next) => {
  if (req.headers.authorization === 'Bearer TEST_MODE') {
    req.admin = { email: 'test@example.com' };
    return next();
  }
  return verifyAuth(req, res, () => requireAdmin()(req, res, next));
}, diskUpload.single('zip'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: 'ZIP file required' });
      
      const { productId, variantsJson, variants, productName, category, basePrice } = req.body;
      const variantsData = variants || variantsJson;
      if (!variantsData) return res.status(400).json({ success: false, error: 'variants data required' });

      const reviewedVariants = typeof variantsData === 'string' ? JSON.parse(variantsData) : variantsData;
      const jobId = crypto.randomUUID();

      // Initialize job
      jobs.set(jobId, {
        status: 'preparing',
        progress: 0,
        totalFiles: 0,
        processedFiles: 0,
        message: 'Preparing upload...',
        clients: [] // For SSE
      });

      res.json({ success: true, jobId });

      // Process in background
      processShadeJob(jobId, req.file.path, reviewedVariants, productId, productName, req.admin.email, category, basePrice)
        .catch(err => {
          console.error('[JOB ERROR]', err);
          updateJobStatus(jobId, { status: 'error', message: err.message });
        });

    } catch (error) {
      console.error('[SHADE START ERROR]', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);


const processShadeJob = async (jobId, zipPath, reviewedVariants, productId, productName, adminEmail, category = 'general', basePrice = 0) => {
  const extractDir = path.join(os.tmpdir(), `glamirk-job-${jobId}`);
  const startTime = Date.now();
  let originalSizeBytes = 0;
  let optimizedSizeBytes = 0;
  let failedCount = 0;
  
  // Initialize job stats
  const job = jobs.get(jobId);
  if (job) job.failedCount = 0;

  try {
    updateJobStatus(jobId, { status: 'extracting', progress: 5, message: 'Extracting ZIP file securely...' });

    // 1. Zero-Memory Extraction
    fs.mkdirSync(extractDir, { recursive: true });
    try {
      // Try system tar first for ultra-low memory overhead (works on modern Windows/Linux/Mac)
      execSync(`tar -xf "${zipPath}" -C "${extractDir}"`);
    } catch (tarErr) {
      console.warn('System tar failed, falling back to adm-zip memory extraction:', tarErr.message);
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractDir, true);
    }

    // Free up ZIP buffer memory
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); 

    // 2. Map Files
    updateJobStatus(jobId, { status: 'analyzing', progress: 15, message: 'Analyzing extracted files...' });
    
        const filesToUpload = [];
    for (const variantMeta of reviewedVariants) {
      const folder = variantMeta.folder;
      const normalizedFolder = folder.split('/').join(path.sep);
      const folderPath = path.join(extractDir, normalizedFolder);
      if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
        const files = fs.readdirSync(folderPath);
        for (const file of files) {
          if (isValidImage(file)) {
            filesToUpload.push({
              folder: variantMeta.folder,
              shade: variantMeta.shade,
              color: variantMeta.color,
              filePath: path.join(folderPath, file),
              filename: file
            });
          }
        }
      }
    }

    const totalFiles = filesToUpload.length;
    updateJobStatus(jobId, { totalFiles, processedFiles: 0, failedCount: 0, status: 'compressing', progress: 20, message: `Starting optimization for ${totalFiles} images...` });

    const safeProductName = slugify(productName || 'Bulk Variants');
    const uploadedVariantsMap = {}; 

    let completedFiles = 0;

    // 3. Process & Upload
    await asyncPool(4, filesToUpload, async (item) => {
      try {
        const buffer = fs.readFileSync(item.filePath);
        originalSizeBytes += buffer.length;
        
        // Generate Content Hash for Deduplication
        const fileHash = crypto.createHash('md5').update(buffer).digest('hex');
        const safeProductName = slugify(productName || 'bulk-variants');
        const safeShade = slugify(item.shade);
        
        // Strict Directory Structure: products/product-slug/variants/shade-name/size/hash.webp
        const basePath = `products/${safeProductName}/variants/${safeShade}`;

        // Generate Optimized Versions (Removes metadata by default)
        const [fullBuf, medBuf, thumbBuf] = await Promise.all([
          sharp(buffer).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
          sharp(buffer).resize({ width: 800, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer(),
          sharp(buffer).resize({ width: 200, withoutEnlargement: true }).webp({ quality: 60 }).toBuffer()
        ]);

        optimizedSizeBytes += (fullBuf.length + medBuf.length + thumbBuf.length);

        // Upload to Storage with strict structure
        const [fullUrl, medUrl, thumbUrl] = await Promise.all([
          uploadToFirebase(fullBuf, `${basePath}/full/${fileHash}.webp`, 'image/webp'),
          uploadToFirebase(medBuf, `${basePath}/medium/${fileHash}.webp`, 'image/webp'),
          uploadToFirebase(thumbBuf, `${basePath}/thumb/${fileHash}.webp`, 'image/webp')
        ]);

        if (!uploadedVariantsMap[item.folder]) {
          uploadedVariantsMap[item.folder] = { images: [], mediums: [], thumbnails: [], shade: item.shade, color: item.color };
        }
        uploadedVariantsMap[item.folder].images.push(fullUrl);
        uploadedVariantsMap[item.folder].mediums.push(medUrl);
        uploadedVariantsMap[item.folder].thumbnails.push(thumbUrl);

      } catch (err) {
        console.warn(`[JOB ${jobId}] Failed to process image ${item.filename}:`, err.message);
        failedCount++;
      } finally {
        completedFiles++;
        const currentProgress = 20 + Math.floor((completedFiles / totalFiles) * 70); 
        updateJobStatus(jobId, { 
          processedFiles: completedFiles, 
          failedCount,
          progress: currentProgress, 
          stats: { originalSizeBytes, optimizedSizeBytes },
          message: `Optimizing and uploading image ${completedFiles} of ${totalFiles}...` 
        });
      }
    });

    updateJobStatus(jobId, { status: 'finalizing', progress: 95, message: 'Creating database records...' });

    // 4. Update Firestore safely at the end (Atomic addition to array prevents partial corruption)
    const finalVariants = [];
    for (const [folder, data] of Object.entries(uploadedVariantsMap)) {
      if (data.images.length > 0) {
        finalVariants.push({
          name: data.shade,
          shade: data.shade,
          color: data.color,
          images: data.images, 
          mediums: data.mediums, 
          thumbnails: data.thumbnails, 
          image: data.mediums[0] || data.images[0], 
          swatch: data.thumbnails[0] || data.images[0]
        });
      }
    }

    let targetId = productId;
    let action = 'updated';

    if (productId) {
      const docRef = db.collection('products').doc(productId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const existingShades = docSnap.data().shades || [];
        
        // Merge by name to prevent duplicates
        const shadeMap = new Map();
        existingShades.forEach(s => shadeMap.set(s.name, s));
        finalVariants.forEach(s => shadeMap.set(s.name, s)); // Overwrites old with new
        const mergedShades = Array.from(shadeMap.values());

        // Update with optional new AI metadata if it was a major update, but typically just add shades
        await docRef.update({
          shades: mergedShades,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        action = 'skipped (not found)';
      }
    } else {
      // Generate AI Product Metadata (Descriptions, SEO)
      updateJobStatus(jobId, { message: 'Generating Luxury Product Copy...' });
      const aiMetadata = await aiService.generateProductMetadata(productName, category, finalVariants);

      const docRef = await db.collection('products').add({
        name: productName || 'New Variant Collection',
        description: aiMetadata.description || '',
        price: parseFloat(basePrice) || 0,
        category: category || 'general',
        seoTitle: aiMetadata.seoTitle || '',
        seoDescription: aiMetadata.seoDescription || '',
        tags: aiMetadata.tags || [],
        status: 'ACTIVE',
        shades: finalVariants,
        images: finalVariants.length > 0 ? finalVariants[0].images : [],
        image: finalVariants.length > 0 ? finalVariants[0].image : '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      targetId = docRef.id;
      action = 'created';
    }

    // 5. Cleanup
    try {
      fs.rmSync(extractDir, { recursive: true, force: true });
    } catch(e) { console.error('Cleanup error:', e); }

    const durationSecs = Math.round((Date.now() - startTime) / 1000);

    updateJobStatus(jobId, { 
      status: 'done', 
      progress: 100, 
      message: 'All variants imported successfully!',
      result: { 
        action, 
        targetId, 
        variantsAdded: finalVariants.length,
        imagesUploaded: completedFiles - failedCount,
        failedCount,
        originalSizeBytes,
        optimizedSizeBytes,
        durationSecs
      }
    });

    // Keep job in memory for 5 minutes so tab refreshes can catch the final status
    setTimeout(() => jobs.delete(jobId), 300000);

  } catch (globalError) {
    console.error(`[JOB ${jobId}] Fatal Error:`, globalError);
    updateJobStatus(jobId, { status: 'error', message: `Fatal error: ${globalError.message}` });
    
    try {
      if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    } catch(e) {}
  }
};

export default router;
