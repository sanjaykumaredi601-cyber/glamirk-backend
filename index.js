import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import Razorpay from 'razorpay';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';

import adminRoutes from './routes/adminRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import importRoutes from './routes/importRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import productAdminRoutes from './routes/productAdminRoutes.js';
import { db, admin, getWithTimeout } from './firebase-admin.js';
import localProducts from './data/products.js';
import localCategories from './data/categories.js';
import categoryImageOverrides, { isBrokenUrl } from './categoryStore.js';

dotenv.config({ path: '../.env.local' });
dotenv.config({ path: '../.env' });

// ==================================================
// STEP 1 — VERIFY ENV
// ==================================================
if (!process.env.OPENROUTER_API_KEY) {
    console.warn('\n==================================================');
    console.warn('⚠️ WARNING: OPENROUTER_API_KEY is missing!');
    console.warn('AI features (shade naming, descriptions) will gracefully fallback to local generation.');
    console.warn('The server will not crash and operations will continue normally.');
    console.warn('==================================================\n');
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "https://glamirk-prod.web.app",
  "https://glamirk-prod.firebaseapp.com",
  "https://www.glamirk.com",
  "https://glamirk.com",
];

app.use(cors({
  origin: function(origin, callback) {
    // allow server-to-server or Postman requests
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error("CORS blocked:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

// CORS preflight handled by app.use(cors()) above
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(helmet({
    crossOriginResourcePolicy: false, // Required for cross-origin image loading
}));
app.set('io', io);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('join_ticket', (ticketId) => {
        socket.join(ticketId);
    });
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

app.get('/', (req, res) => {
    res.json({ status: 'API running' });
});

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/import', importRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin/products', productAdminRoutes);

// Public CMS Route
app.get('/api/cms', async (req, res) => {
    try {
        const [homeResult, pagesResult, settingsResult] = await Promise.allSettled([
            getWithTimeout(db.collection('cms').doc('homepage')),
            getWithTimeout(db.collection('cms').doc('pages')),
            getWithTimeout(db.collection('cms').doc('siteSettings'))
        ]);

        const resolve = (result) => {
            if (result.status === 'fulfilled' && result.value?.exists) {
                return result.value.data();
            }
            return null;
        };

        res.json({
            success: true,
            homepage: resolve(homeResult),
            pages: resolve(pagesResult),
            siteSettings: resolve(settingsResult)
        });
    } catch (error) {
        console.error('Public CMS Fetch Error:', error);
        // Return empty but valid response so frontend can use defaults
        res.json({
            success: true,
            homepage: null,
            pages: null,
            siteSettings: null
        });
    }
});

// Public Products Route — serves products to the frontend without client-side Firestore
app.get('/api/products', async (req, res) => {
    try {
        const [result] = await Promise.allSettled([
            getWithTimeout(db.collection('products').orderBy('createdAt', 'desc'))
        ]);

        if (result.status === 'fulfilled' && result.value?.docs?.length > 0) {
            const products = result.value.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return res.json({ success: true, products });
        }
        
        res.json({ success: true, products: [] });
    } catch (error) {
        console.error('[API] Products fetch error:', error.message);
        res.json({ success: true, products: [] });
    }
});

// Public Categories Route
app.get('/api/categories', async (req, res) => {
    try {
        const [result] = await Promise.allSettled([
            getWithTimeout(db.collection('categories').orderBy('order', 'asc'))
        ]);

        if (result.status === 'fulfilled' && result.value?.docs?.length > 0) {
            const categories = result.value.docs.map(doc => {
                const data = doc.data();
                const firestoreImage = isBrokenUrl(data.image) ? '' : (data.image || '');
                return {
                    id: doc.id,
                    ...data,
                    image: categoryImageOverrides[doc.id] || firestoreImage
                };
            });
            return res.json({ success: true, categories });
        }
        
        res.json({ success: true, categories: [] });
    } catch (error) {
        res.json({ success: true, categories: [] });
    }
});

import aiService from './services/openaiService.js';

const razorpay = (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) ? new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
}) : null;

app.post('/api/chat', async (req, res) => {
    const { messages } = req.body;
    try {
        const result = await aiService.chatWithConcierge(messages);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch AI response' });
    }
});

// Legacy create-order (deprecated, move to /api/payments/create-order)
app.post('/api/create-order', (req, res) => {
    res.redirect(307, '/api/payments/create-order');
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

// Seeding Categories if missing
const seedCategories = async () => {
    try {
        const defaultCategories = [
            { name: "Eyes", slug: "eyes", order: 1, isActive: true, image: "" },
            { name: "Lipstick", slug: "lipstick", order: 2, isActive: true, image: "" },
            { name: "Nails", slug: "nails", order: 3, isActive: true, image: "" },
            { name: "Mascara", slug: "mascara", order: 4, isActive: true, image: "" },
            { name: "Sindoor", slug: "sindoor", order: 5, isActive: true, image: "" },
            { name: "Best Sellers", slug: "best-sellers", order: 6, isActive: true, image: "" }
        ];

        for (const cat of defaultCategories) {
            const docRef = db.collection('categories').doc(cat.slug);
            const doc = await docRef.get();
            if (!doc.exists) {
                console.log(`[SEED] Creating missing category: ${cat.slug}`);
                await docRef.set({ ...cat, createdAt: admin.firestore.FieldValue.serverTimestamp() });
            } else {
                // Ensure order and name are correct for the 6-category system
                const data = doc.data();
                if (data.order !== cat.order || data.name !== cat.name) {
                    console.log(`[SEED] Updating category metadata: ${cat.slug}`);
                    await docRef.update({ order: cat.order, name: cat.name });
                }
            }
        }
    } catch (err) {
        console.error('[SEED] Error seeding categories:', err.message);
    }
};

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    console.log(`Glamirk AI Server running on port ${PORT}`);
    seedCategories();
});

process.on('unhandledRejection', (err) => { console.error('UNHANDLED REJECTION!', err); });
process.on('uncaughtException', (err) => { console.error('UNCAUGHT EXCEPTION!', err); });
// trigger restart
