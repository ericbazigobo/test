const mongoose = require('mongoose');

const SubscriberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true },
  active: { type: Boolean, default: true },
  // additional metadata
  contact: { type: String },
  address: { type: String },
  notes: { type: String }
}, { timestamps: true });

SubscriberSchema.pre('save', async function(next) {
  if (this.isNew && !this.code) {
    try {
      const prefix = 'SUB';
      const Model = mongoose.model('Subscriber');
      const count = await Model.countDocuments();
      this.code = `${prefix}${String(count + 1).padStart(4, '0')}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('Subscriber', SubscriberSchema);
