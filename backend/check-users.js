import User from "./models/user.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    const users = await User.find({}, "email phone language");
    console.log(JSON.stringify(users, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkUsers();
