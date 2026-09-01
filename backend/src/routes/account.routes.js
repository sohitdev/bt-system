const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const accountController = require("../controllers/account.controller");

const router = express.Router();

//=====Create new account=====//
router.post(
  "/",
  authMiddleware.authMiddleware,
  accountController.createAccount,
);

//=====Get all accounts=====//
router.get(
  "/",
  authMiddleware.authMiddleware,
  accountController.getUserAccounts,
);

//=====Get account balance by ID=====//

router.get(
  "/balance/:accountId",
  authMiddleware.authMiddleware,
  accountController.getAccountBalance,
);
router.get("/:accountId/history", authMiddleware.authMiddleware, accountController.getAccountHistory);

module.exports = router;
