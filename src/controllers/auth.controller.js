const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");

async function register(req, res) {
  const { email, name, password } = req.body;

  const isUserExists = await userModel.findOne({ email });
  if (isUserExists) {
    return res.status(422).json({
      message: "Email already exists with this email",
      status: "failed",
    });
  }

  const user = userModel.create({
    email,
    name,
    password: hash,
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
}

module.exports = { register };
