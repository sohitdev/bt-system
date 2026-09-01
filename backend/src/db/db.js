const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const accounts = mongoose.connection.collection("accounts");
    const indexes = await accounts.indexes();
    const legacyUserIndex = indexes.find((index) => index.name === "userID_1" && index.unique);
    if (legacyUserIndex) {
      await accounts.dropIndex("userID_1");
      console.log("removed legacy one-account-per-user index");
    }
    console.log("connected to DB");
  } catch (err) {
    console.log("Database connection error", err);
    process.exit(1);
  }
}

module.exports = connectDB;
