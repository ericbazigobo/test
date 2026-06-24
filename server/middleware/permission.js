const RolePermission = require('../models/RolePermission');

const getDefaultModulesForRole = (role) => {
  switch (role) {
    case 'doctor':
      return ['patients', 'admissions', 'rooms', 'laboratory', 'appointments'];
    case 'nurse':
      return ['patients', 'admissions', 'rooms', 'laboratory'];
    case 'pharmacist':
      return ['pharmacies'];
    case 'cashier':
      return ['billing'];
    case 'lab':
      return ['laboratory'];
    case 'staff':
      return ['patients', 'appointments'];
    default:
      return [];
  }
};

const checkPermission = (allowedModulesList) => {
  return async (req, res, next) => {
    // Admin always has access to all modules
    if (req.user.role === 'admin') {
      return next();
    }
    
    const modulesToCheck = Array.isArray(allowedModulesList) ? allowedModulesList : [allowedModulesList];
    try {
      const perm = await RolePermission.findOne({ role: req.user.role });
      const userAllowed = perm ? perm.allowedModules : getDefaultModulesForRole(req.user.role);
      
      const hasAccess = modulesToCheck.some(m => userAllowed.includes(m));
      if (hasAccess) {
        return next();
      }
      return res.status(403).json({ message: `Accès refusé: vous n'avez pas l'autorisation pour le module ${modulesToCheck.join(', ')}` });
    } catch (error) {
      console.error('Error checking permission:', error);
      res.status(500).json({ message: 'Erreur lors de la vérification des permissions' });
    }
  };
};

module.exports = { checkPermission, getDefaultModulesForRole };
