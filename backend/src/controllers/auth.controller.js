const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const emailService = require("../services/email.service");
const tokenBlacklistModel = require("../models/blacklist.model");

async function register(req, res) {
  try {
    const { email, name, password } = req.body;

    const isUserExists = await userModel.findOne({ email });
    if (isUserExists) {
      return res.status(422).json({
        message: "Email already exists with this email",
        status: "failed",
      });
    }

    const user = await userModel.create({
      email,
      name,
      password,
    });

    const token = jwt.sign({ userID: user._id }, process.env.JWT_SECRET, {
      expiresIn: "3d",
    });

    res.cookie("token", token);

    res.status(201).json({
      message: "User registered successfully",
      status: "success",
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });

    await emailService.sendRegstrationEmail(user.email, user.name);
  } catch (error) {
    res.status(500).json({ message: error.message, status: "failed" });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email }).select("+password");

    if (!user) {
      return res
        .status(401)
        .json({ message: "User not found", status: "login failed" });
    }

    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ message: "Invalid password", status: "login failed" });
    }

    const token = jwt.sign({ userID: user._id }, process.env.JWT_SECRET, {
      expiresIn: "3d",
    });

    res.cookie("token", token);

    res.status(200).json({
      message: "User logged in successfully",
      status: "success",
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message, status: "login failed" });
  }
}

async function logout(req, res) {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized access: Token is missing" });
    }

    // Clear the cookie
    res.clearCookie("token");

    // Add the token to the blacklist
    await tokenBlacklistModel.create({ token });
    res
      .status(200)
      .json({ message: "User logged out successfully", status: "success" });
  } catch (error) {
    res.status(500).json({ message: error.message, status: "logout failed" });
  }
}

async function me(req, res) {
  res.status(200).json({
    user: { id: req.user._id, email: req.user.email, name: req.user.name },
  });
}

module.exports = { register, login, logout, me };
