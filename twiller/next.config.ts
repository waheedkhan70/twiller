// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
//   env: {
//     BACKEND_URL: process.env.BACKEND_URL,
//   },
//   eslint: {
//     ignoreDuringBuilds: true,
//   },
// };

// export default nextConfig;



import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    BACKEND_URL: process.env.BACKEND_URL,
  },
  // The 'eslint' block was removed from here
};

export default nextConfig;