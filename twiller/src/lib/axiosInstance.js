import axios from "axios";

const axiosInstance = axios.create({
  baseURL: process.env.BACKEND_URL || "https://twiller-backend-yyp2.onrender.com",
  headers: {
    "Content-Type": "application/json",
  },
});
export default axiosInstance;
