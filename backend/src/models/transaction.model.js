const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    fromAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "account",
      required: [true, "Transaction must have a source account"],
      index: true,
    },

    toAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "account",
      required: [true, "Transaction must have a destination account"],
      index: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED", "REVERSED"],
      default: "PENDING",
    },
    amount: {
      type: Number,
      required: [true, "Transaction must have an amount"],
      min: [0, "Transaction amount must be positive"],
    },
    idempotencyKey: {
      type: String,
      required: [
        true,
        "Idempotency key is required for creating a transaction",
      ],
      unique: true,
    },
  },
  {
    timestamps: true,
  },
);

const transactionModel = mongoose.model("transaction", transactionSchema);

module.exports = transactionModel;
