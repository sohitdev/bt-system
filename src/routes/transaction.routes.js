const express = require("express");
const transactionController = require("../controllers/transaction.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

router.post(
  "/",
  authMiddleware.authMiddleware,
  transactionController.createTransaction,
);

//post /api/transaction/system/initial-funds
//create initial funds transaction for system user
router.post(
  "/system/initial-funds",
  authMiddleware.authSystemUserMiddleware,
  transactionController.createInitialFundsTransaction,
);

module.exports = router;
