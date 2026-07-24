const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  companyId: {
    type: String,
    required: true,
    default: 'FIC001',
    index: true
  },
  visitorProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'VisitorProfile' },
  profileId: { type: String, required: true },
  visitId: { type: String, unique: true },
  visitorName: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  email: { type: String },
  companyName: { type: String },
  hostName: { type: String, required: true },
  hostTeam: { type: String, default: 'General' },
  visitorCount: { type: Number, default: 1 },
  purpose: { type: String, required: true },
  visitDate: { type: String, required: true },
  expectedArrivalTime: { type: String },
  hostNotes: { type: String },
  bookingId: { type: String },
  registrationType: { type: String, enum: ['Walk-in', 'Pre-Booking'], default: 'Walk-in' },
  aadhaarNumber: { type: String },
  idType: { type: String, default: 'Aadhaar Card' },
  vehicleNumber: { type: String },
  expectedDuration: { type: String },
  idProofUrl: { type: String },
  notes: { type: String },
  isDraft: { type: Boolean, default: false },
  hostId: { type: String },
  createdBy: { type: String },
  approvalTime: { type: Date },
  rejectionReason: { type: String },
  status: { 
    type: String, 
    enum: ["Draft", "Pending Approval", "Pre-Booked", "Pending", "Approved", "Rejected", "Checked In", "Checked Out", "Cancelled", "Expired", "Inside", "Exited"], 
    default: 'Pending Approval' 
  },
  branch: { type: String, required: true },
  currentZone: { type: String },
  entryTime: { type: String },
  exitTime: { type: String },
  qrCode: { type: String },
  qrPayload: { type: Object },
  approvedBy: { type: String },
  remarks: { type: String },
  photoUrl: { type: String },
  checkedIn: { type: Boolean, default: false },
  zoneLogs: [{
    zoneName: String,
    entryTime: Date,
    exitTime: Date,
    durationMinutes: Number
  }]
}, { timestamps: true });

visitorSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    delete ret._id;
  }
});

module.exports = mongoose.model('Visitor', visitorSchema);
