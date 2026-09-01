const express = require("express");
const authController = require("../controllers/auth.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);

//=====logout route
router.post("/logout", authController.logout);
router.get("/me", authMiddleware, authController.me);

module.exports = router;
