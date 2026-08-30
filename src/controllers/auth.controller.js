const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");

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
  } catch (error) {
    res.status(500).json({ message: error.message, status: "failed" });
  }
}

module.exports = { register };
