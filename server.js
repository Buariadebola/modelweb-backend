const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const modelRoutes = require('./routes/modelRoutes');
const adminModelRoutes = require('./routes/adminModelRoutes');
const { ensureDefaultAdmin } = require('./controllers/authController');
const modelPostLikeRoutes = require('./routes/modelPostLikeRoutes');
const {startAutomaticPostLikes} = require('./services/modelPostLikeService');

const app = express();
const server = http.createServer(app);
const DEFAULT_PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = Array.from(
  new Set([
    CLIENT_URL,
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5177',
    'http://localhost:5178',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'http://127.0.0.1:5176',
    'http://127.0.0.1:5177',
    'http://127.0.0.1:5178',
  ])
);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const io = new Server(server, {
  cors: corsOptions,
});

app.set('io', io);
app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Model portfolio messaging API is running.',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/admin/models', adminModelRoutes);
app.use('/api/model-posts', modelPostLikeRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);

  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'Uploaded file is too large.',
    });
  }

  if (err && err.message) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  return res.status(err.status || 500).json({
    success: false,
    message: 'Internal server error.',
  });
});

require('./socket/chatSocket')(io);

const startServer = async () => {
  await connectDB();

  // Start automatic post likes after MongoDB is connected
  startAutomaticPostLikes();

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    await ensureDefaultAdmin({
      name: 'Model Owner',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    });
  }

  const listenOnPort = (port) => {
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.warn(`Port ${port} is busy, trying ${port + 1}...`);
        listenOnPort(port + 1);
        return;
      }

      throw error;
    });

    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  };

  listenOnPort(DEFAULT_PORT);
};

startServer();
