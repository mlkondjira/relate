const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { auth, requireCouple } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// ─── Formule Haversine ────────────────────────────────────────
// Retourne la distance en km entre deux points GPS
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistance = (km) => {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
};

// ─── Schéma de validation ─────────────────────────────────────
const checkinSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  label: z.string().max(50).optional(),
});

// ─── POST /api/checkins ───────────────────────────────────────
// Enregistrer sa position actuelle
router.post('/', auth, async (req, res) => {
  try {
    const data = checkinSchema.parse(req.body);

    const checkin = await prisma.checkIn.create({
      data: {
        userId: req.user.id,
        latitude: data.latitude,
        longitude: data.longitude,
        label: data.label || null,
      },
    });

    // Si l'utilisateur est en couple, notifier le partenaire via Socket.io
    if (req.coupleId && req.couple) {
      const partnerId =
        req.couple.user1Id === req.user.id ? req.couple.user2Id : req.couple.user1Id;

      req.io?.to(partnerId).emit('partner:checkin', {
        userId: req.user.id,
        label: checkin.label,
        createdAt: checkin.createdAt,
      });
    }

    // Calculer la distance avec le partenaire si en couple
    let distanceInfo = null;
    if (req.coupleId && req.couple) {
      const partnerId =
        req.couple.user1Id === req.user.id ? req.couple.user2Id : req.couple.user1Id;

      const partnerLastCheckin = await prisma.checkIn.findFirst({
        where: { userId: partnerId },
        orderBy: { createdAt: 'desc' },
      });

      if (partnerLastCheckin) {
        const km = haversineDistance(
          data.latitude,
          data.longitude,
          partnerLastCheckin.latitude,
          partnerLastCheckin.longitude
        );
        distanceInfo = {
          km: parseFloat(km.toFixed(1)),
          formatted: formatDistance(km),
          partnerCheckinAt: partnerLastCheckin.createdAt,
        };
      }
    }

    res.status(201).json({ checkin, distance: distanceInfo });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/checkins/distance ───────────────────────────────
// Récupérer la distance actuelle avec le partenaire
router.get('/distance', auth, requireCouple, async (req, res) => {
  try {
    const partnerId =
      req.couple.user1Id === req.user.id ? req.couple.user2Id : req.couple.user1Id;

    const [myLastCheckin, partnerLastCheckin] = await Promise.all([
      prisma.checkIn.findFirst({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.checkIn.findFirst({
        where: { userId: partnerId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!myLastCheckin || !partnerLastCheckin) {
      return res.json({
        distance: null,
        message: 'Check-in manquant — un des deux partenaires n\'a pas encore partagé sa position',
        myLastCheckin,
        partnerLastCheckin,
      });
    }

    const km = haversineDistance(
      myLastCheckin.latitude,
      myLastCheckin.longitude,
      partnerLastCheckin.latitude,
      partnerLastCheckin.longitude
    );

    res.json({
      distance: {
        km: parseFloat(km.toFixed(1)),
        formatted: formatDistance(km),
      },
      myLastCheckin: {
        label: myLastCheckin.label,
        createdAt: myLastCheckin.createdAt,
      },
      partnerLastCheckin: {
        label: partnerLastCheckin.label,
        createdAt: partnerLastCheckin.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/checkins/my ─────────────────────────────────────
// Historique de ses propres check-ins
router.get('/my', auth, async (req, res) => {
  const checkins = await prisma.checkIn.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json({ checkins });
});

module.exports = router;
