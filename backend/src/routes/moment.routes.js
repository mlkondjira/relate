// ════════════════════════════════════════════════
// routes/moment.routes.js
// ════════════════════════════════════════════════
const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { auth, requireCouple } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

const momentSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  scheduledAt: z.string().datetime(),
  location: z.string().max(100).optional(),
});

router.get('/', auth, requireCouple, async (req, res) => {
  const moments = await prisma.moment.findMany({
    where: { coupleId: req.coupleId },
    orderBy: { scheduledAt: 'asc' },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  res.json({ moments });
});

router.post('/', auth, requireCouple, async (req, res) => {
  try {
    const data = momentSchema.parse(req.body);
    const moment = await prisma.moment.create({
      data: {
        ...data,
        scheduledAt: new Date(data.scheduledAt),
        coupleId: req.coupleId,
        createdById: req.user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    req.io?.to(req.coupleId).emit('moment:created', moment);
    res.status(201).json({ moment });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', auth, requireCouple, async (req, res) => {
  const moment = await prisma.moment.findFirst({
    where: { id: req.params.id, coupleId: req.coupleId },
  });
  if (!moment) return res.status(404).json({ error: 'Moment introuvable' });

  await prisma.moment.delete({ where: { id: moment.id } });
  req.io?.to(req.coupleId).emit('moment:deleted', { id: moment.id });
  res.json({ success: true });
});

module.exports = router;
