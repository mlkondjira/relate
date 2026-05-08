require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { initSocket } = require('./services/socket.service');

// Routes
const authRoutes = require('./routes/auth.routes');
const coupleRoutes = require('./routes/couple.routes');
const checkinRoutes = require('./routes/checkin.routes');
const messageRoutes = require('./routes/message.routes');
const momentRoutes = require('./routes/moment.routes');
const cycleRoutes = require('./routes/cycle.routes');
const profileRoutes = require('./routes/profile.routes');

const app = express();
const server = http.createServer(app);

// ─── Socket.io ────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
});
initSocket(io);

// ─── Middleware globaux ────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

// Attacher io à chaque requête (utile pour émettre depuis les controllers)
app.use((req, _res, next) => {
  req.io = io;
  next();
});

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/couple', coupleRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/moments', momentRoutes);
app.use('/api/cycle', cycleRoutes);
app.use('/api/profile', profileRoutes);

// Health check
app.get('/health', async (_req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    await p.$connect();
    await p.$disconnect();
    res.json({ status: 'ok', database: 'connected', app: 'Relate API' });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({ status: 'error', database: 'disconnected', message: err.message });
  }
});

// ─── Gestion d'erreurs globale ────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Relate API running on port ${PORT}`);
});
