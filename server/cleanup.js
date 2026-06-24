require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');

const cleanup = async () => {
  await connectDB();
  
  console.log('🗑️ Nettoyage de la base de données...');
  try {
    const deletedUsers = await User.deleteMany();
    console.log(`✅ ${deletedUsers.deletedCount} utilisateurs supprimés`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error.message);
    process.exit(1);
  }
};

cleanup();
