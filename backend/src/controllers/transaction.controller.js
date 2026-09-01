const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const userModel = require("../models/user.model");
const mongoose = require("mongoose");
const emailService = require("../services/email.service");

async function createTransaction(req, res) {
  const { fromAccount, toAccount, amount, idempotencyKey } = req.body;

  if (!fromAccount || !toAccount || !amount || !idempotencyKey || Number(amount) <= 0) {
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

  if (String(fromUserAccount.userID._id) !== String(req.user._id)) {
    return res.status(403).json({ message: "You can only transfer from your own account" });
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

  let session;

  try {
    session = await mongoose.startSession();
    await session.startTransaction();

    const transaction = await transactionModel.create(
      [{ fromAccount, toAccount, amount, idempotencyKey, status: "PENDING" }],
      { session },
    );

    const debitLedgerEntry = await ledgerModel.create(
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

    const creditLedgerEntry = await ledgerModel.create(
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

    await transactionModel.findByIdAndUpdate(
      transaction[0]._id,
      { status: "COMPLETED" },
      { session },
    );

    await session.commitTransaction();

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

    session.endSession();

    return res.status(201).json({
      message: "Transaction completed successfully",
      transaction: transaction[0],
    });
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        // ignore abort errors during cleanup
      }
      session.endSession();
    }

    // Classify error: permanent (400/404/409) vs transient (202)
    const errorMsg = error.message || "";
    const isNotFoundError =
      errorMsg.includes("not found") ||
      errorMsg.includes("doesn't exist") ||
      error.name === "CastError";
    const isValidationError =
      errorMsg.includes("Insufficient balance") ||
      errorMsg.includes("Missing required fields") ||
      errorMsg.includes("must be") ||
      error.name === "ValidationError";
    const isDuplicateError =
      errorMsg.includes("duplicate") ||
      errorMsg.includes("E11000") ||
      error.code === 11000;

    if (isNotFoundError) {
      return res
        .status(404)
        .json({ message: "Account not found", error: errorMsg });
    }
    if (isValidationError) {
      return res
        .status(400)
        .json({ message: "Invalid transaction", error: errorMsg });
    }
    if (isDuplicateError) {
      return res.status(409).json({
        message: "Duplicate transaction (idempotencyKey already exists)",
        error: errorMsg,
      });
    }

    // Assume transient errors (timeout, connection, session)
    return res.status(202).json({
      message:
        "Transaction is pending due to processing delay or temporary failure. Please retry later.",
      status: "PENDING",
      details: error.message,
    });
  }
}

async function createInitialFundsTransaction(req, res) {
  const { toAccount, amount, idempotencyKey } = req.body;

  if (!toAccount || !amount || !idempotencyKey) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (Number(amount) <= 0) {
    return res
      .status(400)
      .json({ message: "Amount must be greater than zero" });
  }

  let toUserAccount = await accountModel.findById(toAccount).populate("userID");

  if (!toUserAccount) {
    toUserAccount = await accountModel
      .findOne({ userID: toAccount })
      .populate("userID");
  }

  if (!toUserAccount) {
    return res.status(404).json({ message: "Receiver account not found" });
  }

  const systemUser = await userModel.findOne({ systemUser: true });
  if (!systemUser) {
    return res.status(404).json({ message: "System user not found" });
  }

  const fromUserAccount = await accountModel
    .findOne({ userID: systemUser._id })
    .populate("userID");

  if (!fromUserAccount) {
    return res.status(404).json({ message: "System account not found" });
  }

  // Check if transaction with same idempotencyKey already exists
  const isTransactionAlreadyExists = await transactionModel.findOne({
    idempotencyKey,
  });

  if (isTransactionAlreadyExists) {
    if (isTransactionAlreadyExists.status === "COMPLETED") {
      return res.status(200).json({
        message: "Initial funds transaction already processed successfully",
        transaction: isTransactionAlreadyExists,
      });
    }
    if (isTransactionAlreadyExists.status === "PENDING") {
      return res.status(200).json({
        message: "Initial funds transaction is still pending",
        transaction: isTransactionAlreadyExists,
      });
    }
    if (isTransactionAlreadyExists.status === "FAILED") {
      return res.status(500).json({
        message:
          "Initial funds transaction processing failed, please try again",
        transaction: isTransactionAlreadyExists,
      });
    }
    if (isTransactionAlreadyExists.status === "REVERSED") {
      return res.status(500).json({
        message: "Initial funds transaction has been reversed",
        transaction: isTransactionAlreadyExists,
      });
    }
  }

  let session;

  try {
    session = await mongoose.startSession();
    await session.startTransaction();

    const [transaction] = await transactionModel.create(
      [
        {
          fromAccount: fromUserAccount._id,
          toAccount: toUserAccount._id,
          amount,
          idempotencyKey,
          status: "PENDING",
        },
      ],
      { session },
    );

    await ledgerModel.create(
      [
        {
          account: fromUserAccount._id,
          amount,
          transaction: transaction._id,
          type: "DEBIT",
        },
      ],
      { session },
    );

    await ledgerModel.create(
      [
        {
          account: toUserAccount._id,
          amount,
          transaction: transaction._id,
          type: "CREDIT",
        },
      ],
      { session },
    );

    await transactionModel.findByIdAndUpdate(
      transaction._id,
      { status: "COMPLETED" },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Initial funds transaction completed successfully",
      transaction,
    });
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        // ignore cleanup abort errors
      }
      session.endSession();
    }

    // Classify error: permanent (400/404/409) vs transient (202)
    const errorMsg = error.message || "";
    const isNotFoundError =
      errorMsg.includes("not found") ||
      errorMsg.includes("doesn't exist") ||
      error.name === "CastError";
    const isValidationError =
      errorMsg.includes("Missing required fields") ||
      errorMsg.includes("must be") ||
      error.name === "ValidationError";
    const isDuplicateError =
      errorMsg.includes("duplicate") ||
      errorMsg.includes("E11000") ||
      error.code === 11000;

    if (isNotFoundError) {
      return res
        .status(404)
        .json({ message: "Account not found", error: errorMsg });
    }
    if (isValidationError) {
      return res
        .status(400)
        .json({ message: "Invalid transaction", error: errorMsg });
    }
    if (isDuplicateError) {
      return res.status(409).json({
        message: "Duplicate transaction (idempotencyKey already exists)",
        error: errorMsg,
      });
    }

    // Assume transient errors (timeout, connection, session)
    return res.status(202).json({
      message:
        "Transaction is pending due to processing delay or temporary failure. Please retry later.",
      status: "PENDING",
      details: error.message,
    });
  }
}

module.exports = { createTransaction, createInitialFundsTransaction };
