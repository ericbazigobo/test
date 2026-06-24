const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String }, // Pour garder une trace même si l'utilisateur est supprimé
  action: { type: String, required: true }, // ex: 'CREATE', 'UPDATE', 'DELETE'
  targetModel: { type: String, required: true }, // ex: 'Patient', 'Invoice'
  targetId: { type: mongoose.Schema.Types.ObjectId },
  details: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
