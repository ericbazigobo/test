const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');
const Medicine = require('../models/Medicine');

const activeSessions = new Map();

const BATCH_SIZE = 100;

// Flexible column name detection - supports many variations
const findColumnValue = (row, possibleNames) => {
  // First try exact matches
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name];
    }
  }
  // Then try case-insensitive match on all row keys
  const rowKeys = Object.keys(row);
  for (const name of possibleNames) {
    const found = rowKeys.find(k => k.toLowerCase().trim() === name.toLowerCase().trim());
    if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') {
      return row[found];
    }
  }
  // Try partial match (column contains one of the names)
  for (const name of possibleNames) {
    const found = rowKeys.find(k => k.toLowerCase().includes(name.toLowerCase()));
    if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') {
      return row[found];
    }
  }
  return undefined;
};

// All possible names for each column
const NAME_COLUMNS = ['Nom', 'name', 'Name', 'NOM', 'nom', 'Designation', 'designation', 'DESIGNATION', 'Médicament', 'medicament', 'MEDICAMENT', 'Produit', 'produit', 'PRODUIT', 'Article', 'article', 'ARTICLE', 'Libellé', 'libelle', 'LIBELLE', 'Libelle', 'Description', 'description'];
const PRICE_COLUMNS = ['Prix', 'price', 'Price', 'PRIX', 'prix', 'PU', 'pu', 'P.U', 'p.u', 'Prix Unitaire', 'prix unitaire', 'PRIX UNITAIRE', 'cout', 'Cout', 'COUT', 'Coût', 'Tarif', 'tarif', 'TARIF', 'Montant', 'montant'];
const CODE_COLUMNS = ['Code', 'code', 'CODE', 'Ref', 'ref', 'REF', 'Reference', 'reference', 'REFERENCE', 'Référence', 'ID', 'id'];
const STOCK_COLUMNS = ['Stock', 'stock', 'STOCK', 'Quantité', 'quantite', 'QUANTITE', 'Quantite', 'Qté', 'qte', 'QTE', 'Qty', 'qty', 'QTY'];
const THRESHOLD_COLUMNS = ['Seuil', 'seuil', 'SEUIL', 'lowStockThreshold', 'Threshold', 'threshold', 'Minimum', 'minimum', 'Min', 'min'];

class ImportSession {
  constructor(pharmacyId, totalRows) {
    this.id = uuidv4();
    this.pharmacyId = pharmacyId;
    this.totalRows = totalRows;
    this.processedRows = 0;
    this.importedCount = 0;
    this.errorCount = 0;
    this.status = 'processing';
    this.errors = [];
    this.warnings = [];
    this.startTime = Date.now();
  }

  getProgress() {
    return {
      id: this.id,
      status: this.status,
      totalRows: this.totalRows,
      processedRows: this.processedRows,
      importedCount: this.importedCount,
      errorCount: this.errorCount,
      warningCount: this.warnings.length,
      percentComplete: this.totalRows > 0 ? Math.round((this.processedRows / this.totalRows) * 100) : 0,
      elapsedSeconds: Math.round((Date.now() - this.startTime) / 1000),
      warnings: this.warnings.slice(-10)
    };
  }

  addWarning(msg) {
    this.warnings.push(msg);
  }

  updateProgress(processedRows, importedCount, errors = []) {
    this.processedRows = processedRows;
    this.importedCount = importedCount;
    this.errorCount = errors.length;
    this.errors = errors.slice(0, 10);
  }

  complete() {
    this.status = 'completed';
  }

  fail(error) {
    this.status = 'failed';
    this.errors.push(error.message);
  }
}

exports.startImportSession = async (pharmacyId, buffer) => {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    // If the sheet has no recognized columns, try treating the first row as header
    // and re-parse. Also handle sheets where the first column has no header.
    if (rawData.length === 0) {
      throw new Error('Le fichier Excel est vide ou ne contient aucune donnée.');
    }

    // Log the keys for debugging
    const sampleRow = rawData[0];
    const sampleKeys = Object.keys(sampleRow);
    console.log('[Import] Column names detected:', sampleKeys);
    console.log('[Import] Sample row:', JSON.stringify(sampleRow));

    // Check if we can detect at least the name column
    const testName = findColumnValue(sampleRow, NAME_COLUMNS);
    if (!testName) {
      // Maybe the data is in the first 2 columns without proper headers
      // Try to use the first column as name and second as price
      console.log('[Import] Could not find name column. Attempting positional import (col1=name, col2=price)');
      
      // Re-read with header option
      const rawArray = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      // Skip the header row
      const dataRows = rawArray.slice(1).filter(row => row && row.length > 0 && row[0]);
      
      if (dataRows.length === 0) {
        throw new Error(`Colonnes détectées: ${sampleKeys.join(', ')}. Aucune colonne "Nom" trouvée. Utilisez une colonne nommée: Nom, Designation, Médicament, Produit, ou Article.`);
      }

      // Get header row
      const headerRow = rawArray[0];
      console.log('[Import] Positional import - headers:', headerRow);
      
      // Convert positional data back to objects with forced names
      const convertedData = dataRows.map(row => ({
        Nom: String(row[0] || '').trim(),
        Prix: row[1] !== undefined ? Number(row[1]) || 0 : 0,
        Stock: row[2] !== undefined ? Number(row[2]) || 0 : 0,
        Code: row[3] !== undefined ? String(row[3]).trim() : ''
      }));

      const session = new ImportSession(pharmacyId, convertedData.length);
      activeSessions.set(session.id, {
        session,
        data: convertedData,
        pharmacyId
      });
      processImportBatch(session.id);
      return session.getProgress();
    }

    const session = new ImportSession(pharmacyId, rawData.length);
    activeSessions.set(session.id, {
      session,
      data: rawData,
      pharmacyId
    });

    processImportBatch(session.id);
    return session.getProgress();
  } catch (error) {
    throw new Error(`Erreur lecture fichier: ${error.message}`);
  }
};

exports.getImportProgress = (sessionId) => {
  const entry = activeSessions.get(sessionId);
  if (!entry) throw new Error('Session non trouvée');
  return entry.session.getProgress();
};

const processImportBatch = async (sessionId) => {
  const entry = activeSessions.get(sessionId);
  if (!entry) return;

  const { session, data, pharmacyId } = entry;

  try {
    let processed = 0;
    let imported = 0;
    const errors = [];

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);

      for (const row of batch) {
        try {
          // Use flexible column detection
          const name = String(findColumnValue(row, NAME_COLUMNS) || '').trim();
          let code = String(findColumnValue(row, CODE_COLUMNS) || '').trim();
          const stockVal = findColumnValue(row, STOCK_COLUMNS);
          const priceVal = findColumnValue(row, PRICE_COLUMNS);
          const thresholdVal = findColumnValue(row, THRESHOLD_COLUMNS);

          if (!name) {
            errors.push(`Ligne ${i + processed + 2}: Nom manquant`);
            processed++;
            continue;
          }

          // Automatic code generation if missing
          if (!code) {
            code = await Medicine.generateCode(name, pharmacyId);
          }

          const existingByName = await Medicine.findOne({ name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }, pharmacyId });
          const existingByCode = code ? await Medicine.findOne({ code, pharmacyId }) : null;

          if (existingByName || existingByCode) {
            session.addWarning(`Ligne ${i + processed + 2}: "${name}" existait déjà. Mise à jour effectuée.`);
          }

          const quantity = Number(stockVal) || 0;
          const price = Number(priceVal) || 0;
          const existing = existingByCode || existingByName;

          if (existing) {
            existing.name = name;
            existing.code = code;
            if (price > 0) existing.price = price;
            if (thresholdVal !== undefined) {
              existing.lowStockThreshold = Number(thresholdVal) || existing.lowStockThreshold;
            }
            if (quantity > 0) {
              existing.stock += quantity;
              existing.movements.push({ type: 'in', quantity, note: 'Import Excel' });
            }
            await existing.save();
            imported++;
          } else {
            const medicine = new Medicine({
              name,
              code,
              stock: quantity,
              price: price,
              pharmacyId,
              movements: quantity > 0 ? [{ type: 'in', quantity, note: 'Import Excel' }] : []
            });
            await medicine.save();
            imported++;
          }

          processed++;
        } catch (err) {
          errors.push(`Ligne ${i + processed + 2}: ${err.message}`);
          processed++;
        }
      }

      session.updateProgress(processed, imported, errors);

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    session.complete();
    session.updateProgress(processed, imported, errors);
    console.log(`[Import] Completed: ${imported}/${processed} imported for pharmacy ${pharmacyId}`);

    // Clean up after 5 minutes
    setTimeout(() => {
      activeSessions.delete(sessionId);
    }, 5 * 60 * 1000);
  } catch (error) {
    console.error('[Import] Failed:', error);
    session.fail(error);
  }
};

exports.cleanupExpiredSessions = () => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000;
  for (const [sessionId, { session }] of activeSessions.entries()) {
    if (now - session.startTime > maxAge) {
      activeSessions.delete(sessionId);
    }
  }
};

setInterval(() => {
  exports.cleanupExpiredSessions();
}, 10 * 60 * 1000);
