import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { db, admin } from '../firebase-admin.js';

const router = express.Router();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Create Razorpay Order ──
router.post('/create-order', async (req, res) => {
    try {
        const { amount, currency = 'INR', receipt } = req.body;
        
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(503).json({ error: 'Razorpay is not configured on server' });
        }

        const options = {
            amount: Math.round(amount * 100), // amount in the smallest currency unit (paise)
            currency,
            receipt: receipt || `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error('[PAYMENT] Create Order Error:', error);
        res.status(500).json({ error: 'Failed to create Razorpay order' });
    }
});

// ── Verify Payment & Save Order ──
router.post('/verify-payment', async (req, res) => {
    try {
        const { 
            razorpay_order_id, 
            razorpay_payment_id, 
            razorpay_signature,
            orderData 
        } = req.body;

        // 1. Verify Signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        const isSignatureValid = expectedSignature === razorpay_signature;

        if (!isSignatureValid) {
            console.error('[PAYMENT] Invalid Signature');
            return res.status(400).json({ success: false, error: 'Invalid payment signature' });
        }

        // 2. Double Check Payment Status with Razorpay (Optional but safer)
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        if (payment.status !== 'captured' && payment.status !== 'authorized') {
             // If not captured, you might want to wait or handle failure
             // Note: Razorpay auto-captures if configured, but here we check status
        }

        // 3. Save Order to Firestore (Server-side)
        // Ensure orderData is sanitized or reconstructed here for security
        const finalOrderData = {
            ...orderData,
            paymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            paymentStatus: 'paid',
            orderStatus: 'PLACED',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            serverVerified: true
        };

        const docRef = await db.collection('orders').add(finalOrderData);
        
        console.log(`[PAYMENT] Order saved successfully: ${docRef.id}`);

        res.json({ 
            success: true, 
            orderId: docRef.id,
            message: 'Payment verified and order saved' 
        });
    } catch (error) {
        console.error('[PAYMENT] Verification Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error during verification' });
    }
});

export default router;
