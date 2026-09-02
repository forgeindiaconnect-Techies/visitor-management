const mongoose = require('mongoose');

const userInvitationSchema =
  new mongoose.Schema(
    {
      companyId: {
        type: String,
        required: true,
        uppercase: true,
        index: true
      },

      name: {
        type: String,
        required: true,
        trim: true
      },

      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true
      },

      role: {
        type: String,
        required: true,
        enum: [
          'Admin',
          'MD',
          'HR',
          'Senior HR',
          'Receptionist',
          'Security',
          'Employee'
        ]
      },

      branch: {
        type: String,
        required: true
      },

      department: {
        type: String,
        default: ''
      },

      tokenHash: {
        type: String,
        required: true,
        unique: true
      },

      expiresAt: {
        type: Date,
        required: true
      },

      used: {
        type: Boolean,
        default: false
      },

      invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    },
    {
      timestamps: true
    }
  );

userInvitationSchema.index({
  companyId: 1,
  email: 1,
  used: 1
});

module.exports = mongoose.model(
  'UserInvitation',
  userInvitationSchema
);
