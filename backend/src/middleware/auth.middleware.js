const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");
const tokenBlacklistModel = require("../models/blacklist.model");

async function authMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .json({ message: "Unauthorized access: Token is missing" });
  }

  // Check if the token is in the blacklist
  const isBlacklisted = await tokenBlacklistModel.findOne({ token });
  if (isBlacklisted) {
    return res
      .status(401)
      .json({ message: "Unauthorized access: Token is invalid" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(decoded.userID);

    if (!user) {
      return res
        .status(401)
        .json({ message: "Unauthorized access: User not found" });
    }

    req.user = user;

    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Unauthorized access: Token is Invalid" });
  }
}

async function authSystemUserMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .json({ message: "Unauthorized access: Token is missing" });
  }

  // Check if the token is in the blacklist
  const isBlacklisted = await tokenBlacklistModel.findOne({ token });
  if (isBlacklisted) {
    return res
      .status(401)
      .json({ message: "Unauthorized access: Token is invalid" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userModel.findById(decoded.userID).select("+systemUser");

    if (!user.systemUser) {
      return res
        .status(403)
        .json({ message: "Forbidden access: User not found" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Unauthorized access: Token is Invalid" });
  }
}

module.exports = { authMiddleware, authSystemUserMiddleware };
