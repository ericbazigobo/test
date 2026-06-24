const mongoose = require('mongoose');

const SubscriberRestrictionSchema = new mongoose.Schema({
  subscriber: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true },
  medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
  allowed: { type: Boolean, default: true } // true = allowed, false = forbidden
}, { timestamps: true });

SubscriberRestrictionSchema.index({ subscriber: 1, medicine: 1 }, { unique: true });

module.exports = mongoose.model('SubscriberRestriction', SubscriberRestrictionSchema);
