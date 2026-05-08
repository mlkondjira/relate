const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Map userId → socketId pour émettre vers un utilisateur spécifique
const userSockets = new Map();

const initSocket = (io) => {
  // Authentification Socket.io via JWT
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Token manquant'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true },
      });
      if (!user) return next(new Error('Utilisateur introuvable'));

      socket.userId = user.id;
      socket.userName = user.name;
      next();
    } catch {
      next(new Error('Token invalide'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    userSockets.set(userId, socket.id);

    // Rejoindre sa propre room (pour recevoir des notifications ciblées)
    socket.join(userId);

    // Marquer l'utilisateur comme online
    await prisma.user.update({
      where: { id: userId },
      data: { isOnline: true, lastSeen: new Date() },
    });

    // Notifier le partenaire de la connexion
    const couple = await prisma.couple.findFirst({
      where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
    });

    if (couple) {
      const partnerId = couple.user1Id === userId ? couple.user2Id : couple.user1Id;
      io.to(partnerId).emit('partner:online', {
        userId,
        isOnline: true,
        lastSeen: new Date(),
      });

      // Rejoindre la room du couple pour la messagerie
      socket.join(`couple:${couple.id}`);
    }

    // ─── Messagerie temps réel ─────────────────────────────
    socket.on('message:send', async (data) => {
      try {
        const { content, coupleId } = data;
        if (!content || !coupleId) return;

        // Vérifier que l'utilisateur appartient bien à ce couple
        const coupleCheck = await prisma.couple.findFirst({
          where: {
            id: coupleId,
            OR: [{ user1Id: userId }, { user2Id: userId }],
          },
        });
        if (!coupleCheck) return;

        const message = await prisma.message.create({
          data: {
            coupleId,
            senderId: userId,
            content, // En prod: chiffrer avant insertion
          },
          include: {
            sender: { select: { id: true, name: true, avatar: true } },
          },
        });

        // Émettre à tous les membres du couple
        io.to(`couple:${coupleId}`).emit('message:new', message);
      } catch (err) {
        console.error('Socket message:send error:', err);
      }
    });

    // ─── Indicateur de frappe ──────────────────────────────
    socket.on('message:typing', ({ coupleId, isTyping }) => {
      socket.to(`couple:${coupleId}`).emit('partner:typing', {
        userId,
        isTyping,
      });
    });

    // ─── Marquer messages comme lus ────────────────────────
    socket.on('messages:read', async ({ coupleId }) => {
      await prisma.message.updateMany({
        where: {
          coupleId,
          senderId: { not: userId },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      socket.to(`couple:${coupleId}`).emit('messages:read', { by: userId });
    });

    // ─── Déconnexion ───────────────────────────────────────
    socket.on('disconnect', async () => {
      userSockets.delete(userId);

      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: false, lastSeen: new Date() },
      });

      if (couple) {
        const partnerId = couple.user1Id === userId ? couple.user2Id : couple.user1Id;
        io.to(partnerId).emit('partner:online', {
          userId,
          isOnline: false,
          lastSeen: new Date(),
        });
      }
    });
  });
};

module.exports = { initSocket, userSockets };
