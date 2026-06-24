const mongoose = require('mongoose');

const RolePermissionSchema = new mongoose.Schema({
  role: { type: String, required: true, unique: true },
  allowedModules: [{ type: String }] // e.g. ['patients', 'admissions', 'rooms', 'pharmacies', 'billing', 'staff', 'laboratory', 'appointments', 'reports']
}, { timestamps: true });

module.exports = mongoose.model('RolePermission', RolePermissionSchema);
