const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { auth, requireCouple } = require('../middleware/auth.middleware');

const router = express.Router();
const prisma = new PrismaClient();

// ─── Chiffrement AES-256-GCM ──────────────────────────────────
const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.CYCLE_ENCRYPTION_KEY || 'a'.repeat(32), 'utf8').slice(0, 32);

const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

const decrypt = (encryptedStr) => {
  const [ivHex, tagHex, dataHex] = encryptedStr.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
};

// ─── Schéma ────────────────────────────────────────────────────
const cycleSchema = z.object({
  date: z.string().datetime(),
  phase: z.enum(['MENSTRUAL', 'FOLLICULAR', 'OVULATION', 'LUTEAL']),
  cycleDay: z.number().int().min(1).max(35),
  notes: z.string().max(500).optional(),
  symptoms: z.array(z.string()).optional(),
  shareWithPartner: z.boolean().default(false),
});

// ─── POST /api/cycle ──────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const data = cycleSchema.parse(req.body);

    // Chiffrer les données sensibles avant insertion
    const sensitiveData = { notes: data.notes, symptoms: data.symptoms };
    const encryptedData = encrypt(JSON.stringify(sensitiveData));

    const entry = await prisma.cycleEntry.create({
      data: {
        userId: req.user.id,
        date: new Date(data.date),
        phase: data.phase,
        cycleDay: data.cycleDay,
        shareWithPartner: data.shareWithPartner,
        encryptedData,
      },
    });

    res.status(201).json({
      entry: {
        id: entry.id,
        date: entry.date,
        phase: entry.phase,
        cycleDay: entry.cycleDay,
        shareWithPartner: entry.shareWithPartner,
        notes: data.notes,
        symptoms: data.symptoms,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/cycle/my ────────────────────────────────────────
// Entrées de l'utilisateur (déchiffrées)
router.get('/my', auth, async (req, res) => {
  const entries = await prisma.cycleEntry.findMany({
    where: { userId: req.user.id },
    orderBy: { date: 'desc' },
    take: 90,
  });

  const decrypted = entries.map((e) => {
    let sensitive = {};
    try { sensitive = JSON.parse(decrypt(e.encryptedData)); } catch {}
    return {
      id: e.id,
      date: e.date,
      phase: e.phase,
      cycleDay: e.cycleDay,
      shareWithPartner: e.shareWithPartner,
      ...sensitive,
    };
  });

  res.json({ entries: decrypted });
});

// ─── GET /api/cycle/partner ───────────────────────────────────
// Données partagées par le/la partenaire (phases uniquement, jamais les notes/symptômes)
router.get('/partner', auth, requireCouple, async (req, res) => {
  const partnerId =
    req.couple.user1Id === req.user.id ? req.couple.user2Id : req.couple.user1Id;

  const entries = await prisma.cycleEntry.findMany({
    where: { userId: partnerId, shareWithPartner: true },
    orderBy: { date: 'desc' },
    take: 30,
    select: {
      id: true,
      date: true,
      phase: true,
      cycleDay: true,
      // encryptedData NON retourné — privacy by design
    },
  });

  res.json({ entries });
});

module.exports = router;
