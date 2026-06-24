const mongoose = require('mongoose');

const AgentSchema = new mongoose.Schema({
  subscriber: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscriber', required: true, index: true },
  firstName: { type: String },
  lastName: { type: String },
  family: { type: String },
  relation: { type: String },
  identifier: { type: String },
  phone: { type: String },
  email: { type: String },
  code: { type: String, unique: true, index: true },
  familyCode: { type: String },
  meta: { type: Object }
}, { timestamps: true });

AgentSchema.statics.generateCodeForSubscriber = async function(subscriberId) {
  const count = await this.countDocuments({ subscriber: subscriberId });
  const seq = (count + 1).toString().padStart(4, '0');
  return `AG${seq}`;
};

module.exports = mongoose.model('Agent', AgentSchema);
