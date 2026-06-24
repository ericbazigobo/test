const mongoose = require('mongoose');
require('dotenv').config();
const Pharmacy = require('./models/Pharmacy');
const connectDB = require('./config/db');

async function updateThresholds() {
    try {
        await connectDB();
        console.log('Connected to DB');
        
        const result = await Pharmacy.updateMany(
            { lowStockThreshold: 5 },
            { $set: { lowStockThreshold: 20 } }
        );
        
        console.log(`Updated ${result.nModified || result.modifiedCount} pharmacies.`);
        
        // Also update pharmacies that might not have the field yet or have a null value (though they have a default)
        const result2 = await Pharmacy.updateMany(
            { lowStockThreshold: { $exists: false } },
            { $set: { lowStockThreshold: 20 } }
        );
        console.log(`Updated ${result2.nModified || result2.modifiedCount} pharmacies that lacked the field.`);

        console.log('Update complete');
        process.exit(0);
    } catch (error) {
        console.error('Error updating thresholds:', error);
        process.exit(1);
    }
}

updateThresholds();
