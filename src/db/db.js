const mongoose = require("mongoose");

async function connectDB() {
  mongoose.connect(process.env.MONGO_URI);
  console.log("connected to DB");
}

module.exports = connectDB;
