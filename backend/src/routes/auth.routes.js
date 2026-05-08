const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// ─── Schémas de validation ────────────────────────────────────
const registerSchema = z.object({
  name: z.string().min(2, 'Nom trop court').max(50),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe trop court (8 car. min)'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ─── Helper ───────────────────────────────────────────────────
const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const formatUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatar: user.avatar,
  isOnline: user.isOnline,
  lastSeen: user.lastSeen,
});

// ─── POST /api/auth/register ──────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
      },
    });

    const token = generateToken(user.id);

    res.status(201).json({
      token,
      user: formatUser(user),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Mettre à jour le statut online
    await prisma.user.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeen: new Date() },
    });

    const token = generateToken(user.id);

    res.json({
      token,
      user: formatUser(user),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        coupleAsUser1: {
          include: {
            user2: { select: { id: true, name: true, avatar: true, isOnline: true, lastSeen: true } },
          },
        },
        coupleAsUser2: {
          include: {
            user1: { select: { id: true, name: true, avatar: true, isOnline: true, lastSeen: true } },
          },
        },
      },
    });

    const couple = user.coupleAsUser1 || user.coupleAsUser2;
    const partner = couple?.user2 || couple?.user1 || null;

    res.json({
      user: formatUser(user),
      couple: couple ? { id: couple.id } : null,
      partner,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────
router.post('/logout', auth, async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { isOnline: false, lastSeen: new Date() },
  });
  res.json({ success: true });
});

// ─── PATCH /api/auth/push-token ───────────────────────────────
router.patch('/push-token', auth, async (req, res) => {
  const { pushToken } = req.body;
  await prisma.user.update({
    where: { id: req.user.id },
    data: { pushToken },
  });
  res.json({ success: true });
});

module.exports = router;
