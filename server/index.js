require('./utils/configManager');
require('dotenv').config();
const express = require('express');
const http    = require('http');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const connectDB            = require('./config/db');
const authRoutes           = require('./routes/auth');
const patientRoutes        = require('./routes/patients');
const admissionRoutes      = require('./routes/admissions');
const roomRoutes           = require('./routes/rooms');
const pharmacyRoutes       = require('./routes/pharmacy');
const staffRoutes          = require('./routes/staff');
const appointmentRoutes    = require('./routes/appointments');
const billingRoutes        = require('./routes/billing');
const reportRoutes         = require('./routes/reports');
const expenseRoutes        = require('./routes/expenses');
const consultationRoutes   = require('./routes/consultations');
const prescriptionRoutes   = require('./routes/prescriptions');
const subscriberRoutes     = require('./routes/subscribers');
const labRoutes            = require('./routes/lab');
const attendanceRoutes     = require('./routes/attendance');
const supplierRoutes       = require('./routes/suppliers');
const reseedRoutes         = require('./routes/reseed');
const backupDatabase       = require('./utils/backup');

// ── Express app + HTTP server ────────────────────────────────────────────────
const app        = express();
const httpServer = http.createServer(app);

// ── WebSocket (Socket.io) ─────────────────────────────────────────────────────
let io = null;
try {
  const { Server } = require('socket.io');
  io = new Server(httpServer, {
    path: '/socket.io/',
    cors: { origin: '*' }
  });
  io.on('connection', (socket) => {
    socket.on('error', () => {});
  });
  console.log('✅ Socket.io actif sur /socket.io/');
} catch (e) {
  console.log('⚠️  Socket.io non disponible — WebSocket désactivé');
}

const broadcast = (data) => {
  if (!io) return;
  io.emit('broadcast', data);
};

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  try { console.log('REQ', req.method, req.originalUrl); } catch (_) {}
  next();
});
app.use((req, res, next) => {
  req.setTimeout(30000);
  res.setTimeout(30000);
  req.broadcast = broadcast;   // controllers peuvent utiliser req.broadcast()
  next();
});

// ── Static client ────────────────────────────────────────────────────────────
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) app.use(express.static(clientDist));

// ── API routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/patients',      patientRoutes);
app.use('/api/admissions',    admissionRoutes);
app.use('/api/rooms',         roomRoutes);
app.use('/api/pharmacy',      pharmacyRoutes);
app.use('/api/staff',         staffRoutes);
app.use('/api/appointments',  appointmentRoutes);
app.use('/api/billing',       billingRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/expenses',      expenseRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/subscribers',   subscriberRoutes);
app.use('/api/lab',           labRoutes);
app.use('/api/attendance',    attendanceRoutes);
app.use('/api/suppliers',     supplierRoutes);
app.use('/api/reseed',        reseedRoutes);

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Critical Backend Error:', err.stack);
  res.status(500).json({
    message: 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).json({ message: 'Page introuvable' });
});

// ── Permissions bootstrap ────────────────────────────────────────────────────
const initDefaultPermissions = async () => {
  try {
    const RolePermission = require('./models/RolePermission');
    if (await RolePermission.countDocuments() === 0) {
      const { getDefaultModulesForRole } = require('./middleware/permission');
      for (const role of ['doctor','nurse','pharmacist','cashier','lab','staff']) {
        await RolePermission.create({ role, allowedModules: getDefaultModulesForRole(role) });
      }
      console.log('🛡️ Permissions par défaut initialisées');
    }
  } catch (e) { console.error('❌ Erreur permissions:', e.message); }
};

// ── Auto-seed admin ──────────────────────────────────────────────────────────
const autoSeedAdminIfEmpty = async () => {
  try {
    const bcrypt   = require('bcryptjs');
    const User     = require('./models/User');
    const Pharmacy = require('./models/Pharmacy');
    if (await User.countDocuments() > 0) {
      console.log(`✅ Base OK — ${await User.countDocuments()} utilisateur(s)`);
      return;
    }
    console.log('⚙️ Base vide — Création admin par défaut...');
    let pharmacy = await Pharmacy.findOne({ code: 'PHARM-001' });
    if (!pharmacy) {
      pharmacy = await Pharmacy.create({ name:'Pharmacie Centrale', code:'PHARM-001', address:'Bâtiment Principal', manager:'Administrateur' });
    }
    await User.create({
      name: 'Administrateur Général',
      email: 'admin@emeraude.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'admin',
      pharmacyId: pharmacy._id
    });
    console.log('✅ Compte admin créé : admin@emeraude.com / admin123');
  } catch (e) { console.error('❌ Erreur auto-seed:', e.message); }
};

// ── Start ────────────────────────────────────────────────────────────────────
const startServer = async (port = process.env.PORT || 3000) => {
  await connectDB();
  await autoSeedAdminIfEmpty();
  await initDefaultPermissions();
  return new Promise((resolve, reject) => {
    httpServer.listen(port, () => {
      httpServer.timeout = 30000;
      const addr = httpServer.address();
      const activePort = typeof addr === 'string' ? addr : addr.port;
      console.log(`✅ Serveur démarré sur le port ${activePort}`);
      const { runThresholdMigration } = require('./controllers/pharmacyController');
      runThresholdMigration();
      backupDatabase();
      resolve(activePort);
    });
    httpServer.on('error', reject);
  });
};

if (require.main === module) {
  startServer().catch(err => { console.error('Erreur serveur:', err); process.exit(1); });
}

module.exports = { app, startServer, broadcast };
