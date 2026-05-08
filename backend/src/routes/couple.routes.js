const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auth, requireCouple } = require('../middleware/auth.middleware');
const { sendPushNotification } = require('../services/notification.service');

const router = express.Router();
const prisma = new PrismaClient();

// Génère un code d'invitation à 6 caractères alphanum
const generateInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// ─── POST /api/couple/invite ──────────────────────────────────
// Crée un code d'invitation
router.post('/invite', auth, async (req, res) => {
  try {
    if (req.coupleId) {
      return res.status(400).json({ error: 'Vous êtes déjà en couple' });
    }

    // Invalider les anciennes invitations de cet utilisateur
    await prisma.coupleInvite.updateMany({
      where: { senderId: req.user.id, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });

    const code = generateInviteCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const invite = await prisma.coupleInvite.create({
      data: {
        senderId: req.user.id,
        code,
        expiresAt,
      },
    });

    res.status(201).json({
      code: invite.code,
      expiresAt: invite.expiresAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /api/couple/join ────────────────────────────────────
// Rejoindre un couple avec un code
router.post('/join', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code requis' });
    if (req.coupleId) return res.status(400).json({ error: 'Vous êtes déjà en couple' });

    const invite = await prisma.coupleInvite.findUnique({
      where: { code: code.toUpperCase() },
      include: { sender: true },
    });

    if (!invite) return res.status(404).json({ error: 'Code invalide' });
    if (invite.status !== 'PENDING') return res.status(400).json({ error: 'Code déjà utilisé' });
    if (new Date() > invite.expiresAt) {
      await prisma.coupleInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
      return res.status(400).json({ error: 'Code expiré' });
    }
    if (invite.senderId === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas rejoindre votre propre invitation' });
    }

    // Créer le couple et marquer l'invitation comme acceptée dans une transaction
    const [couple] = await prisma.$transaction([
      prisma.couple.create({
        data: {
          user1Id: invite.senderId,
          user2Id: req.user.id,
        },
        include: {
          user1: { select: { id: true, name: true, avatar: true } },
          user2: { select: { id: true, name: true, avatar: true } },
        },
      }),
      prisma.coupleInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED', receiverId: req.user.id },
      }),
    ]);

    // Notifier l'invitant
    if (invite.sender.pushToken) {
      await sendPushNotification(invite.sender.pushToken, {
        title: 'Relate',
        body: `${req.user.name} a rejoint votre espace couple !`,
        data: { type: 'COUPLE_JOINED' },
      });
    }

    // Émettre via Socket.io
    req.io?.to(invite.senderId).emit('couple:joined', {
      couple: { id: couple.id },
      partner: couple.user2,
    });

    res.status(201).json({
      couple: { id: couple.id },
      partner: invite.sender,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/couple/me ───────────────────────────────────────
router.get('/me', auth, requireCouple, async (req, res) => {
  try {
    const couple = await prisma.couple.findUnique({
      where: { id: req.coupleId },
      include: {
        user1: { select: { id: true, name: true, avatar: true, isOnline: true, lastSeen: true } },
        user2: { select: { id: true, name: true, avatar: true, isOnline: true, lastSeen: true } },
      },
    });

    const partner = couple.user1Id === req.user.id ? couple.user2 : couple.user1;
    res.json({ couple: { id: couple.id, createdAt: couple.createdAt }, partner });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── DELETE /api/couple/me ────────────────────────────────────
router.delete('/me', auth, requireCouple, async (req, res) => {
  await prisma.couple.delete({ where: { id: req.coupleId } });
  res.json({ success: true });
});

module.exports = router;
