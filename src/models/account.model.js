const mongoose = require("mongoose");
const ledgerModel = require("./ledger.model");

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

accountSchema.methods.getBalance = async function () {
  const balanceData = await ledgerModel.aggregate([
    { $match: { account: this._id } }, // ← account, not accountID
    {
      $group: {
        _id: null,
        totalCredits: {
          $sum: {
            $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0],
          },
        },
        totalDebits: {
          $sum: {
            $cond: [{ $eq: ["$type", "DEBIT"] }, "$amount", 0],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        balance: { $subtract: ["$totalCredits", "$totalDebits"] },
      },
    },
  ]);

  if (balanceData.length === 0) return 0;

  return balanceData[0].balance;
};

const accountModel = mongoose.model("account", accountSchema);

module.exports = accountModel;
