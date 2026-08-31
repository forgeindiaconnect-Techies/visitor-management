const mongoose = require("mongoose");

const approvalPermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "SAAS_SUPER_ADMIN", "MD", "SENIOR_HR", "IT", "HR", "ADMIN", "BRANCH_ADMIN"],
      required: true,
      unique: true,
    },
    canApprove: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "ApprovalPermission",
  approvalPermissionSchema
);
