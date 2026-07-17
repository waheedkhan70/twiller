import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_EMAIL?.trim(),
    pass: process.env.SMTP_PASSWORD?.replace(/\s/g, ""),
  },
});

console.log("Testing SMTP connection...");
transporter.verify(async (error, success) => {
  if (error) {
    console.error("SMTP Connection Error:", error);
  } else {
    console.log("SMTP Server is ready to take our messages");
    try {
      let info = await transporter.sendMail({
        from: `"Test" <${process.env.SMTP_EMAIL?.trim()}>`,
        to: process.env.SMTP_EMAIL?.trim(),
        subject: "Test Email",
        text: "This is a test email.",
      });
      console.log("Message sent: %s", info.messageId);
    } catch (sendError) {
      console.error("Failed to send email:", sendError);
    }
  }
  process.exit();
});
