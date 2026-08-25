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
  trackingToken: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
  trackingTokenExpiresAt: {
    type: Date,
    default: null,
  },
  bookingType: {
    type: String,
    default: "DIRECT_VISIT",
    enum: ["DIRECT_VISIT"]
  },
  visitorName: { type: String, required: true },
  mobileNumber: { 
    type: String, 
    required: true,
    trim: true,
    match: [/^[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9"]
  },
  companyName: { type: String },
  hostName: { type: String, required: true },
  hostTeam: { type: String, default: 'General' },
  visitorCount: { type: Number, default: 1 },
  purpose: { type: String, required: true },
  visitDate: { type: String, required: true },
  expectedArrivalTime: { type: String },
  appointmentEndTime: { type: String },
  visitType: { type: String, enum: ["PRE_BOOKING", "DIRECT_VISIT"], default: "DIRECT_VISIT" },
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
    enum: ["Draft", "Pending Approval", "Pre-Booked", "Pending", "PENDING", "Approved", "APPROVED", "Rejected", "REJECTED", "Checked In", "CHECKED_IN", "Checked Out", "CHECKED_OUT", "Cancelled", "Expired", "Inside", "Exited"], 
    default: 'PENDING' 
  },
  approvalStatus: {
    type: String,
    enum: [
      "PENDING",
      "APPROVED",
      "REJECTED",
      "DATE_CHANGED",
      "TIME_CHANGED",
      "CANCELLED",
      "CHECKED_IN",
      "CHECKED_OUT"
    ],
    default: "PENDING"
  },
  branch: { type: String, required: true },
  currentZone: { type: String },
  entryTime: { type: String },
  exitTime: { type: String },
  checkInTime: { type: Date },
  checkOutTime: { type: Date },
  exitNotes: { type: String },
  qrCode: { type: String },
  qrPayload: { type: Object },
  approvedBy: {
    type: mongoose.Schema.Types.Mixed,
    ref: "User",
    default: null
  },
  approvedByRole: {
    type: String,
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  approvalDetails: {
    approvedBy: String,
    approvedByRole: String,
    approvedAt: Date,
    method: String
  },
  statusHistory: [{
    status: String,
    changedBy: {
      type: mongoose.Schema.Types.Mixed,
      ref: "User"
    },
    changedByRole: String,
    changedAt: { type: Date, default: Date.now },
    reason: String,
    previousAppointmentDate: String,
    newAppointmentDate: String,
    previousAppointmentStartTime: String,
    newAppointmentStartTime: String,
    previousAppointmentEndTime: String,
    newAppointmentEndTime: String
  }],
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
