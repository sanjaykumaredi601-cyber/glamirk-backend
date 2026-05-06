import express from 'express';
import { admin, db } from '../firebase-admin.js';

const router = express.Router();

// @desc    Create/Update a support ticket (Public)
router.post('/', async (req, res) => {
  try {
    const { orderId, message, userEmail, userName } = req.body;
    const cleanOrderId = (orderId || 'general').toLowerCase().trim();
    const cleanEmail = (userEmail || 'anonymous').toLowerCase().trim();

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 1. Check for existing OPEN ticket for same user + order
    const snapshot = await db.collection('tickets')
      .where('userEmail', '==', cleanEmail)
      .where('orderId', '==', cleanOrderId)
      .where('status', '==', 'open')
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const existingTicket = snapshot.docs[0];
      const ticketId = existingTicket.id;
      const ticketData = existingTicket.data();

      // 2. Check if within 5 minutes (for notification purposes)
      const lastUpdate = ticketData.lastUpdatedAt?.seconds || 0;
      const now = Math.floor(Date.now() / 1000);
      const isQuickFollowUp = (now - lastUpdate) < 300; // 5 mins

      // Append message to existing thread
      await db.collection('ticket_messages').add({
        ticketId,
        message,
        senderRole: 'user',
        senderEmail: cleanEmail,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update ticket activity
      await db.collection('tickets').doc(ticketId).update({
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ 
        success: true, 
        ticketId, 
        isDuplicate: true,
        message: isQuickFollowUp 
          ? "Your request is already being handled. We've added your new message to the existing thread." 
          : "Message added to your existing ticket."
      });
    }

    // 3. No existing open ticket -> Create New
    const newTicket = {
      orderId: cleanOrderId,
      message,
      userEmail: cleanEmail,
      userName: userName || 'Guest',
      status: 'open',
      priority: 'low', // Default
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('tickets').add(newTicket);
    
    // Initial timeline event
    await db.collection('ticket_timeline').add({
      ticketId: docRef.id,
      event: 'Ticket created via Concierge',
      performedBy: cleanEmail,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create initial message
    await db.collection('ticket_messages').add({
      ticketId: docRef.id,
      message,
      senderRole: 'user',
      senderEmail: cleanEmail,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(201).json({ success: true, ticketId: docRef.id });
  } catch (error) {
    console.error('Ticket Logic Error:', error);
    res.status(500).json({ error: 'Failed to process support request' });
  }
});

export default router;

