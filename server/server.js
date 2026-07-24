require('dotenv').config({ path: '../.env' }); // Load .env from root directory
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (origin.includes('localhost') || 
          origin.includes('192.168') || 
          origin.includes('10.') || 
          origin === 'https://fic-visitor-1.vercel.app') {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'), false);
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: true
  }
});

// Attach socket.io to the app so routes can use it
app.set('io', io);

io.on('connection', (socket) => {
  console.log('⚡ Socket connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id);
  });
});
const PORT = process.env.PORT || 5000;

// Middleware
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.includes('localhost') || 
        origin.includes('192.168') || 
        origin.includes('10.') || 
        origin === 'https://fic-visitor-1.vercel.app') {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Environment Variable Validation
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingVars.length > 0) {
  console.error(`❌ Missing critical environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// MongoDB Connection
console.log('Connecting to MongoDB...');
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// Routes
const visitorsRouter = require('./routes/visitors');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const zonesRouter = require('./routes/zones');
const blacklistRouter = require('./routes/blacklist');
const alertsRouter = require('./routes/alerts');
const notificationRoutes = require('./routes/notificationRoutes');
const attendanceRouter = require('./routes/attendance');
const branchSettingsRouter = require('./routes/branchSettings');
const superAdminRouter = require('./routes/superAdmin');
const companyRouter = require('./routes/company');
const auditLogsRouter = require('./routes/auditLogs');

const paymentRoutes = require('./routes/paymentRoutes');
const testNotification = require('./routes/testNotification');
const invitationsRouter = require('./routes/invitations');

app.use('/api/visitors', visitorsRouter);
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/zones', zonesRouter);
app.use('/api/blacklist', blacklistRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/notifications', notificationRoutes);
app.use('/api/attendance', attendanceRouter);
app.use('/api/branch-settings', branchSettingsRouter);
app.use('/api/super-admin', superAdminRouter);
app.use('/api/company', companyRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/payment', paymentRoutes);
app.use('/api/test', testNotification);

app.get('/api/network-ip', (req, res) => {
  const os = require('os');
  const nets = os.networkInterfaces();
  let ip = 'localhost';
  for (const name of Object.keys(nets)) {
    // Skip virtual network adapters (WSL, Hyper-V, VMware, VirtualBox)
    if (name.toLowerCase().includes('veth') || name.toLowerCase().includes('wsl') || name.toLowerCase().includes('vmware') || name.toLowerCase().includes('virtual')) {
      continue;
    }
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ip = net.address;
        break;
      }
    }
    if (ip !== 'localhost') break;
  }
  res.json({ ip });
});

// Simple health check route for the root URL
app.get('/', (req, res) => {
  res.json({ status: 'API is running successfully', environment: process.env.NODE_ENV });
});

// Catch-all for unhandled routes
app.use((req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
