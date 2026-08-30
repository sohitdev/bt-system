const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const mongoose = require("mongoose");
const emailService = require("../services/email.service");

async function createTransaction(req, res) {
  const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

  if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const fromUserAccount = await accountModel
    .findById(fromAccount)
    .populate("userID"); // ← populate to get email and name

  const toUserAccount = await accountModel
    .findById(toAccount)
    .populate("userID"); // ← populate to get email and name

  if (!toUserAccount || !fromUserAccount) {
    return res
      .status(404)
      .json({ message: "Receiver or sender account not found" });
  }

  const isTransactionAlreadyExists = await transactionModel.findOne({
    idempotencyKey,
  });

  if (isTransactionAlreadyExists) {
    if (isTransactionAlreadyExists.status === "COMPLETED") {
      return res.status(200).json({
        message: "Transaction already processed successfully",
        transaction: isTransactionAlreadyExists,
      });
    }
    if (isTransactionAlreadyExists.status === "PENDING") {
      return res.status(200).json({
        message: "Transaction is still pending",
        transaction: isTransactionAlreadyExists,
      });
    }
    if (isTransactionAlreadyExists.status === "FAILED") {
      return res.status(500).json({
        message: "Transaction processing failed, please try again",
        transaction: isTransactionAlreadyExists,
      });
    }
    if (isTransactionAlreadyExists.status === "REVERSED") {
      return res.status(500).json({
        message: "Transaction has been reversed",
        transaction: isTransactionAlreadyExists,
      });
    }
  }

  if (
    fromUserAccount.status !== "ACTIVE" ||
    toUserAccount.status !== "ACTIVE"
  ) {
    return res.status(400).json({
      message: "Both accounts must be active to perform a transaction",
    });
  }

  const balance = await fromUserAccount.getBalance();

  if (balance < amount) {
    return res.status(400).json({
      message: `Insufficient balance: available ${balance}, requested ${amount}`,
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transaction = await transactionModel.create(
      [{ fromAccount, toAccount, amount, idempotencyKey, status: "PENDING" }],
      { session },
    );

    await ledgerModel.create(
      [
        {
          account: fromAccount,
          amount,
          transaction: transaction[0]._id,
          type: "DEBIT",
        },
      ],
      { session },
    );

    await ledgerModel.create(
      [
        {
          account: toAccount,
          amount,
          transaction: transaction[0]._id,
          type: "CREDIT",
        },
      ],
      { session },
    );

    transaction[0].status = "COMPLETED";
    await transaction[0].save({ session });

    await session.commitTransaction();
    session.endSession();

    // send email to sender
    await emailService.sendTransactionEmail(
      fromUserAccount.userID.email, // ← works now because of populate
      fromUserAccount.userID.name,
      amount,
      toUserAccount._id,
    );

    // send email to receiver
    await emailService.sendTransactionEmail(
      toUserAccount.userID.email, // ← receiver email, not req.user
      toUserAccount.userID.name,
      amount,
      fromUserAccount._id,
    );

    return res.status(201).json({
      message: "Transaction completed successfully",
      transaction: transaction[0],
    });
  } catch (error) {
    await session.abortTransaction(); // ← rolls back on failure
    session.endSession();
    return res.status(500).json({ message: error.message, status: "failed" });
  }
}

module.exports = { createTransaction };
