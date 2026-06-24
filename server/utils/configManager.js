const fs = require('fs');
const path = require('path');
const os = require('os');

const configDir = path.join(os.homedir(), '.emeraude');
const configPath = path.join(configDir, 'config.json');

const getDefaultConfig = () => ({
  MONGODB_URI: '',
  PORT: 4000,
  JWT_SECRET: 'emeraude-secret-key-super-secure-2026'
});

const loadConfig = () => {
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    if (!fs.existsSync(configPath)) {
      const defaultConfig = getDefaultConfig();
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      return defaultConfig;
    }
    const content = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(content);
    return { ...getDefaultConfig(), ...parsed };
  } catch (err) {
    console.error('Error loading config, using defaults:', err.message);
    return getDefaultConfig();
  }
};

const saveConfig = (newConfig) => {
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    const currentConfig = loadConfig();
    const updated = { ...currentConfig, ...newConfig };
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8');
    
    // Update process.env variables immediately
    if (updated.MONGODB_URI) {
      process.env.MONGODB_URI = updated.MONGODB_URI;
    } else {
      delete process.env.MONGODB_URI;
    }
    if (updated.PORT) {
      process.env.PORT = updated.PORT;
    }
    if (updated.JWT_SECRET) {
      process.env.JWT_SECRET = updated.JWT_SECRET;
    }
    return true;
  } catch (err) {
    console.error('Error saving config:', err.message);
    return false;
  }
};

// Initialize environment variables from config on load
const config = loadConfig();
if (config.MONGODB_URI) {
  process.env.MONGODB_URI = config.MONGODB_URI;
}
if (config.PORT) {
  process.env.PORT = config.PORT;
}
if (config.JWT_SECRET) {
  process.env.JWT_SECRET = config.JWT_SECRET;
}

module.exports = {
  loadConfig,
  saveConfig,
  configPath
};
