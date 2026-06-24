const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const os = require('os');
const backupDatabase = async () => {
  try {
    const backupDir = path.join(os.homedir(), '.emeraude', 'backups');

    // Créer le dossier s'il n'existe pas
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const backupFile = path.join(backupDir, `backup_${dateStr}.json`);

    // S'il y a déjà eu une sauvegarde aujourd'hui, on ne l'écrase pas pour gagner du temps
    if (fs.existsSync(backupFile)) {
      console.log('✅ Sauvegarde du jour déjà existante, ignorée.');
      return;
    }

    // Récupérer tous les modèles enregistrés par mongoose
    const models = mongoose.models;
    const backupData = {};

    for (const modelName in models) {
      if (models.hasOwnProperty(modelName)) {
        const data = await models[modelName].find().lean();
        backupData[modelName] = data;
      }
    }

    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`✅ Sauvegarde automatique réussie dans : ${backupFile}`);

  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde automatique :', error);
  }
};

module.exports = backupDatabase;
