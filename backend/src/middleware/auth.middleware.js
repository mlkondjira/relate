const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        coupleAsUser1: { select: { id: true, user1Id: true, user2Id: true } },
        coupleAsUser2: { select: { id: true, user1Id: true, user2Id: true } },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur introuvable' });
    }

    // Attach user + coupleId to request
    req.user = user;
    req.coupleId = user.coupleAsUser1?.id || user.coupleAsUser2?.id || null;
    req.couple = user.coupleAsUser1 || user.coupleAsUser2 || null;

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expiré' });
    }
    return res.status(401).json({ error: 'Token invalide' });
  }
};

// Middleware optionnel : vérifie que l'utilisateur est dans un couple
const requireCouple = (req, res, next) => {
  if (!req.coupleId) {
    return res.status(403).json({ error: 'Vous devez être en couple pour accéder à cette ressource' });
  }
  next();
};

module.exports = { auth, requireCouple };
