const mongoose = require("mongoose");

const ledgerSchema = new mongoose.Schema(
  {
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "account",
      required: [true, "Ledger must be associated with an account"],
      index: true,
      immutable: true,
    },
    amount: {
      type: Number,
      required: [true, "Ledger must have an amount"],
      min: [0, "Ledger amount must be positive"],
      immutable: true,
    },
    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "transaction",
      required: [true, "Ledger must be associated with a transaction"],
      index: true,
      immutable: true,
    },
    type: {
      type: String,
      enum: {
        values: ["CREDIT", "DEBIT"],
        message: "type can either be CREDIT or DEBIT",
      },
      required: [true, "Ledger must have a type"],
      immutable: true,
    },
  },
  {
    timestamps: true,
  },
);

function preventLedgerModification(next) {
  throw new Error("Ledger entries are immutable and cannot be modified");
}

ledgerSchema.pre("remove", preventLedgerModification);
ledgerSchema.pre("findOneAndUpdate", preventLedgerModification);
ledgerSchema.pre("deleteOne", preventLedgerModification);
ledgerSchema.pre("deleteMany", preventLedgerModification);
ledgerSchema.pre("findOneAndDelete", preventLedgerModification);
ledgerSchema.pre("findOneAndRemove", preventLedgerModification);
ledgerSchema.pre("updateMany", preventLedgerModification);
ledgerSchema.pre("updateOne", preventLedgerModification);

const ledgerModel = mongoose.model("ledger", ledgerSchema);

module.exports = ledgerModel;
