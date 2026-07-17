import dotenv from "dotenv";
import twilio from "twilio";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

console.log("SID:", process.env.TWILIO_ACCOUNT_SID);

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function test() {
  try {
    const message = await twilioClient.messages.create({
      body: "Test SMS from Twiller",
      from: process.env.TWILIO_FROM_NUMBER,
      to: "+919559599556" // some dummy number
    });
    console.log("Success! SID:", message.sid);
  } catch (err) {
    console.error("Twilio Error:", err.message);
  }
}
test();
