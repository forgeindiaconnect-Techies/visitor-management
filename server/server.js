const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

console.log("💳 Active Razorpay Key ID:", process.env.RAZORPAY_KEY_ID || 'Not Configured');

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn('Could not set custom DNS servers:', e.message);
}
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
          origin.includes('vercel.app')) {
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

  socket.on(
    'join-notification-room',
    ({ userId, role, companyId }) => {
      const normalizedRole = String(role || '').trim();
      const normalizedCompanyId = String(
        companyId || ''
      ).trim().toUpperCase();

      if (normalizedRole) {
        socket.join(`notification:${normalizedRole}`);
      }

      if (
        normalizedRole === 'SaaS Super Admin'
      ) {
        socket.join('company:SYSTEM');
      } else if (
        normalizedCompanyId &&
        normalizedCompanyId !== 'SYSTEM'
      ) {
        socket.join(`company:${normalizedCompanyId}`);
      }

      console.log(
        `Socket ${socket.id} joined notification room`
      );
    }
  );

  socket.on('join_saas_room', ({ token }) => {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'secret' // Fallback in case env is not loaded right away
      );

      if (decoded.role !== 'SaaS Super Admin') {
        return;
      }

      socket.join('saas-admins');

      console.log(
        
        `SaaS Super Admin joined real-time room: ${socket.id}`
      );
    } catch (error) {
      console.error('Invalid SaaS socket token');
    }
  });

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
        origin.includes('onrender.com') ||
        origin.includes('vercel.app') ||
        origin === 'https://fic-visitor-1.vercel.app') {
      return callback(null, true);
    }
    console.warn('CORS Blocked Origin:', origin);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
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
  .then(async () => {
    console.log('✅ MongoDB connected successfully');
    
    // Initialize default approval permissions
    const ApprovalPermission = require('./models/ApprovalPermission');
    try {
      const defaultRoles = [
        { role: 'SUPER_ADMIN', canApprove: true },
        { role: 'SAAS_SUPER_ADMIN', canApprove: true },
        { role: 'MD', canApprove: true },
        { role: 'SENIOR_HR', canApprove: true },
        { role: 'ADMIN', canApprove: true },
        { role: 'BRANCH_ADMIN', canApprove: true },
        { role: 'HR', canApprove: true },
        { role: 'IT', canApprove: false }
      ];
      for (const roleDef of defaultRoles) {
        await ApprovalPermission.findOneAndUpdate(
          { role: roleDef.role },
          { $setOnInsert: { canApprove: roleDef.canApprove } },
          { upsert: true }
        );
      }

      // Initialize default subscription plans
      const Plan = require('./models/Plan');
      const defaultPlans = [
        {
          name: 'One Day Trial',
          price: 0,
          durationDays: 1,
          visitorPasses: 25,
          branches: 1,
          users: 3,
          securityUsers: 1,
          admins: 1,
          reports: false,
          description: 'Try the essential visitor management features for 24 hours.',
          features: { qrPass: true, preBooking: true, emailNotifications: true, advancedReports: false, customBranding: false, apiAccess: false, prioritySupport: false },
          isActive: true
        },
        {
          name: 'Basic',
          price: 1999,
          durationDays: 30,
          visitorPasses: 500,
          branches: 1,
          users: 10,
          securityUsers: 5,
          admins: 2,
          reports: true,
          description: 'Suitable for small companies with one branch.',
          features: { qrPass: true, preBooking: true, emailNotifications: true, advancedReports: false, customBranding: false, apiAccess: false, prioritySupport: false },
          isActive: true
        },
        {
          name: 'Standard',
          price: 4999,
          durationDays: 30,
          visitorPasses: 3000,
          branches: 5,
          users: 50,
          securityUsers: 25,
          admins: 10,
          reports: true,
          description: 'Advanced reporting and branding for growing companies.',
          features: { qrPass: true, preBooking: true, emailNotifications: true, advancedReports: true, customBranding: true, apiAccess: false, prioritySupport: false },
          isActive: true
        },
        {
          name: 'Enterprise',
          price: 9999,
          durationDays: 30,
          visitorPasses: -1,
          branches: -1,
          users: -1,
          securityUsers: -1,
          admins: -1,
          reports: true,
          description: 'Unlimited usage with API access and priority support.',
          features: { qrPass: true, preBooking: true, emailNotifications: true, advancedReports: true, customBranding: true, apiAccess: true, prioritySupport: true },
          isActive: true
        }
      ];

      for (const p of defaultPlans) {
        await Plan.updateOne(
          { name: p.name },
          { $setOnInsert: { ...p, updatedBy: 'Initial Setup' } },
          { upsert: true }
        );
      }
      console.log('✅ Subscription plans auto-seeded and verified.');


    } catch (err) {
      console.error('Error initializing default approval permissions or cleanup:', err);
    }
  })
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
const approvalPermissionRoutes = require('./routes/approvalPermissionRoutes');
const invitationsRouter = require('./routes/invitations');
const visitorInvitationRoutes = require('./routes/visitorInvitationRoutes');
const securityRoutes = require('./routes/securityRoutes');
const preBookingRoutes = require('./routes/preBookingRoutes');

app.use('/api/security', securityRoutes);
app.use('/api/prebookings', preBookingRoutes);
app.use('/api/pre-bookings', preBookingRoutes);
app.use('/api/visitors', visitorsRouter);

// Failsafe Public Pass Lookup Endpoint
app.get('/api/pass-lookup/:visitId', async (req, res) => {
  try {
    const { visitId } = req.params;
    const Visitor = require('./models/Visitor');
    const PreBooking = require('./models/PreBooking');
    const cleanId = visitId.trim();
    const digits = cleanId.replace(/\D/g, '');
    const alphaNum = cleanId.replace(/[^a-zA-Z0-9]/g, '');
    const isValidObjectId = require('mongoose').isValidObjectId(cleanId);
    const escapedRaw = cleanId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

    const searchConditions = [
      { visitorId: new RegExp(escapedRaw, 'i') },
      { visitId: new RegExp(escapedRaw, 'i') },
      { profileId: new RegExp(escapedRaw, 'i') },
      { bookingId: new RegExp(escapedRaw, 'i') },
      { mobileNumber: cleanId },
      { qrToken: cleanId },
      { trackingToken: cleanId }
    ];

    if (alphaNum && alphaNum !== cleanId) {
      searchConditions.push({ visitorId: new RegExp(alphaNum, 'i') });
      searchConditions.push({ visitId: new RegExp(alphaNum, 'i') });
      searchConditions.push({ profileId: new RegExp(alphaNum, 'i') });
      searchConditions.push({ bookingId: new RegExp(alphaNum, 'i') });
    }

    if (digits && digits.length >= 2) {
      searchConditions.push({ visitorId: new RegExp(`${digits}$`, 'i') });
      searchConditions.push({ visitId: new RegExp(`${digits}$`, 'i') });
      searchConditions.push({ profileId: new RegExp(`${digits}$`, 'i') });
      searchConditions.push({ bookingId: new RegExp(`${digits}$`, 'i') });
    }

    if (isValidObjectId) {
      searchConditions.push({ _id: cleanId });
    }

    let visitor = await Visitor.findOne({ $or: searchConditions });

    if (!visitor) {
      const pb = await PreBooking.findOne({ $or: searchConditions });

      if (pb) {
        visitor = {
          id: pb._id,
          _id: pb._id,
          visitId: pb.visitorId,
          profileId: pb.visitorId,
          visitorName: pb.fullName,
          fullName: pb.fullName,
          mobileNumber: pb.mobileNumber,
          email: pb.email,
          companyName: pb.visitingCompany || 'Forge India Connect Private Limited',
          hostName: pb.hostEmployee,
          purpose: pb.visitPurpose,
          visitDate: pb.visitDate,
          expectedArrivalTime: pb.expectedTime,
          branch: pb.branchLocation || 'Head Office',
          vehicleNumber: pb.vehicleNumber,
          photoUrl: pb.facePhoto,
          qrToken: pb.qrToken || pb.trackingToken || '',
          trackingToken: pb.trackingToken || pb.qrToken || '',
          status: pb.status === 'PENDING' ? 'Pending' : (pb.status === 'APPROVED' ? 'Approved' : (pb.status === 'CHECKED_IN' ? 'Inside' : pb.status)),
          createdAt: pb.createdAt
        };
      }
    }

    if (!visitor) {
      return res.status(404).json({ success: false, message: 'Visitor pass not found or invalid QR code.' });
    }

    return res.json(visitor);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/zones', zonesRouter);
app.use('/api/blacklist', blacklistRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/visitor-invitations', visitorInvitationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/attendance', attendanceRouter);
app.use('/api/branch-settings', branchSettingsRouter);
app.use('/api/super-admin', superAdminRouter);
app.use('/api/company', companyRouter);
app.use('/api/companies', companyRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/payment', paymentRoutes);
app.use('/api/approval-permissions', approvalPermissionRoutes);
const dashboardRouter = require('./routes/dashboard');
app.use('/api/dashboard', dashboardRouter);

const saasLeadsRouter = require('./routes/saasLeads');
app.use('/api/saas-leads', saasLeadsRouter);

const userInvitationRoutes = require('./routes/userInvitationRoutes');
app.use('/api/user-invitations', userInvitationRoutes);

const planRoutes = require('./routes/planRoutes');
app.use('/api/plans', planRoutes);


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
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT} (bound to 0.0.0.0)`);
});

