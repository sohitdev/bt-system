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

module.exports = { createAccount };
