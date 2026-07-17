# Twiller

Twiller is a feature-rich, full-stack microblogging platform inspired by X (formerly Twitter). It provides modern capabilities like posting text/image/audio tweets, subscription plans, multilingual support with OTP verification, conditional login constraints, and browser notifications.

## 🚀 How to Run and Use

### Prerequisites
- Node.js (v18 or higher recommended)
- MongoDB Database (Local or MongoDB Atlas)

### 1. Setup Backend
1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables. Create a `.env` file in the `backend` directory and configure the following variables:
   ```env
   PORT=5005
   MONGODB_URL=mongodb+srv://<username>:<password>@cluster...
   SMTP_EMAIL=your_email@gmail.com
   SMTP_PASSWORD=your_app_password
   RAZORPAY_KEY_ID=your_razorpay_key
   RAZORPAY_KEY_SECRET=your_razorpay_secret
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_token
   TWILIO_FROM_NUMBER=your_twilio_number
   ```
4. Start the backend server:
   ```bash
   npm start
   ```

### 2. Setup Frontend
1. Open a new terminal and navigate to the `twiller` directory:
   ```bash
   cd twiller
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables. Create a `.env` (or `.env.local`) file in the `twiller` directory:
   ```env
   NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:3000`.

---

## 🧪 Process to Test All Tasks

### 1. Browser Notifications (Keywords: "cricket", "science")
- **How to test:** Go to your profile settings and ensure notifications are enabled. Create a new tweet containing the word "cricket" or "science". 
- **Expected result:** A browser popup notification will appear showing the full content of the tweet. The system strictly respects your profile's notification toggle.

### 2. Audio Tweets & Time Restrictions
- **How to test:** Open the Tweet Composer and click the Mic icon to open the Audio Tweet Modal. Request an OTP (sent to your registered email). After verifying the OTP, record or upload an audio file.
- **Constraints:**
  - **Size/Duration:** The file must not exceed 100 MB or 5 minutes in duration.
  - **Time Window:** You can only upload audio tweets between **2:00 PM and 7:00 PM IST**. Attempts outside this window will be blocked.

### 3. Forgot Password Rate Limiting
- **How to test:** Go to the login page and click "Forgot Password". Enter your email or phone number.
- **Expected result:** The system will generate a temporary password consisting solely of uppercase and lowercase letters (no numbers or special characters).
- **Constraints:** You can only use this feature **once per day**. Trying it a second time on the same day will display: "You can use this option only one time per day."

### 4. Subscription Plans & Tweet Limits
- **How to test:** Click on the "Upgrade" or Premium icon. Select a plan and proceed with the payment via Razorpay.
- **Plan Limits:**
  - **Free:** 1 Tweet
  - **Bronze (₹100/mo):** Up to 3 Tweets
  - **Silver (₹300/mo):** Up to 5 Tweets
  - **Gold (₹1000/mo):** Unlimited Tweets
- **Constraints:**
  - **Time Window:** Payments are strictly restricted and can only be processed between **10:00 AM and 11:00 AM IST**.
  - **Invoice:** Upon successful payment, an invoice with plan details is immediately emailed to you.

### 5. Multi-Language Support & Verification
- **How to test:** Open your profile/settings to change the language. The platform supports English, Spanish, Hindi, Portuguese, Chinese, and French.
- **Verification Constraints:**
  - If you select **French**, you must verify the change via an OTP sent to your **registered email**.
  - If you select **any other language**, you must verify the change via an OTP sent to your **registered mobile number** (via Twilio).

### 6. Environment-Based Login Security
- **How to test:** Log out and try logging back in using different browsers and devices.
- **Constraints:**
  - **Google Chrome:** Requires email OTP verification upon login.
  - **Microsoft Browsers (Edge):** Allowed to log in directly without an OTP.
  - **Mobile Devices:** Mobile logins are only permitted between **10:00 AM and 1:00 PM IST**.
- **Login History:** Go to your profile page to see a transparent record of all your login sessions (Browser, OS, Device Category, IP, and Timestamp).
