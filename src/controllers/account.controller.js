const accountModel = require("../models/account.model");

async function createAccount(req, res) {
  try {
    const user = req.user;

    const account = await accountModel.create({
      userID: user._id,
    });

    res.status(201).json({ account });
  } catch (error) {
    res.status(500).json({ message: error.message, status: "failed" });
  }
}

async function getUserAccounts(req, res) {
  try {
    const user = req.user;

    const accounts = await accountModel.find({ userID: user._id });

    res.status(200).json({ accounts });
  } catch (error) {
    res.status(500).json({ message: error.message, status: "failed" });
  }
}

async function getAccountBalance(req, res) {
  try {
    const { accountId } = req.params;

    const account = await accountModel.findOne({
      _id: accountId,
      userID: req.user._id,
    });

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }
    const balance = await account.getBalance();

    res.status(200).json({ accountId: account._id, balance: balance });
  } catch (error) {
    res.status(500).json({ message: error.message, status: "failed" });
  }
}

module.exports = { createAccount, getUserAccounts, getAccountBalance };
