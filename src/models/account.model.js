const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
  {
    userID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: [true, "Account must be associated with a user"],
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ["ACTIVE", "FROZEN", "CLOSED"],
        message: "Status must be either ACTIVE, FROZEN, or CLOSED",
      },
      default: "ACTIVE",
    },
    currency: {
      type: String,
      required: [true, "Currency is required for account creation"],
      default: "INR",
    },
  },
  {
    timestamps: true,
  },
);

accountSchema.index({ userID: 1, status: 1 });

const accountModel = mongoose.model("account", accountSchema);

module.exports = accountModel;
