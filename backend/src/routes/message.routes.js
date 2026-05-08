// ════════════════════════════════════════════════
// routes/message.routes.js
// ════════════════════════════════════════════════
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireCouple } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// Charger l'historique des messages (pagination par curseur)
router.get('/', auth, requireCouple, async (req, res) => {
  const { cursor, limit = 30 } = req.query;

  const messages = await prisma.message.findMany({
    where: { coupleId: req.coupleId },
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit),
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
    },
  });

  res.json({
    messages: messages.reverse(),
    nextCursor: messages.length === parseInt(limit) ? messages[0].id : null,
  });
});

module.exports = router;
