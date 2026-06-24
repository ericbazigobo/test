const mongoose = require('mongoose');

// Increase the launch timeout to 60 seconds to prevent "Instance failed to start within 10000ms" crashes
process.env.MONGOMS_LAUNCH_TIMEOUT = '60000';
const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const os = require('os');
const path = require('path');

require('dotenv').config();

const getDatabaseUri = async () => {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }

  const dbPath = path.join(os.homedir(), '.emeraude', 'mongodb');
  fs.mkdirSync(dbPath, { recursive: true });

  const lockFile = path.join(dbPath, 'mongod.lock');
  const uriFile  = path.join(dbPath, 'mongod-uri.txt');

  if (fs.existsSync(lockFile)) {
    try {
      // Force removal even if it might be EBUSY - sometimes just trying clears it 
      // or at least we get a definitive error.
      fs.unlinkSync(lockFile);
      console.log('🗑️ Ancien verrou MongoDB supprime');
    } catch (err) {
      if (err.code === 'EBUSY' || err.code === 'EPERM') {
        console.warn('⚠️ Le verrou MongoDB est utilise par un autre processus.');
        if (fs.existsSync(uriFile)) {
          const savedUri = fs.readFileSync(uriFile, 'utf8').trim();
          console.log('♻️ Reutilisation de la connexion existante via le fichier d\'etat.');
          return savedUri;
        }
      } else {
        console.error('❌ Impossible de supprimer le verrou:', err.message);
      }
    }
  }

  const mongod = await MongoMemoryServer.create({
    instance: {
      dbPath,
      storageEngine: 'wiredTiger',
      dbName: process.env.MONGODB_DB_NAME || 'emeraude'
    }
  });

  const uri = mongod.getUri();

  // Persist URI so subsequent launches can reconnect if mongod is still alive.
  try {
    fs.writeFileSync(uriFile, uri, 'utf8');
  } catch (e) {
    console.warn('Could not save MongoDB URI state file:', e.message);
  }

  return uri;
};

const connectDB = async () => {
  try {
    mongoose.set('strictQuery', false);
    mongoose.set('bufferCommands', false);
    mongoose.set('bufferTimeoutMS', 10000);

    const uri = await getDatabaseUri();
    console.log(`⏳ Connexion à MongoDB à l'adresse: ${uri.split('@').pop()}`); // Log simplified URI (no password if any)
    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });

    mongoose.connection.on('connected', () => {
      console.log(`✅ MongoDB connecté avec succès sur: ${conn.connection.host}`);
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected, tentative de reconnexion...');
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

module.exports = connectDB;

