const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

const updateProfileSchema = z.object({
  name: z.string().min(2).max(50).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Mot de passe trop court (8 car. min)'),
});

// ─── PATCH /api/profile ───────────────────────────────────────
router.patch('/', auth, async (req, res) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id: true, email: true, name: true, avatar: true, isOnline: true, lastSeen: true },
    });
    res.json({ user });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /api/profile/change-password ───────────────────────
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── DELETE /api/profile ──────────────────────────────────────
// Suppression de compte + toutes les données associées (RGPD)
router.delete('/', auth, async (req, res) => {
  await prisma.user.delete({ where: { id: req.user.id } });
  res.json({ success: true });
});

module.exports = router;
