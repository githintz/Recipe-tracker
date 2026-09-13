/** @type {import('next').NextConfig} */
const nextConfig = {
  // The Android app ships the UI as plain files inside the APK — there is no
  // server to render anything, so everything is exported statically.
  output: "export",
  images: { unoptimized: true },
  // Recipe ids are created on the device at runtime, so they can't be baked
  // into static paths. Screens that act on one record take it from the query
  // string (/recipe?id=…) instead of a dynamic segment.
  trailingSlash: true,
};

export default nextConfig;
