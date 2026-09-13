import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ladle.recipebox",
  appName: "Ladle",
  // Next exports the whole UI here; the APK ships these files inside itself.
  webDir: "out",
  android: {
    /**
     * Without this the WebView is laid out edge to edge and the app draws
     * under the status bar, so the header collides with the clock and signal
     * icons. Capacitor's default here is "disable"; forcing it adds the
     * margins on every Android version rather than only on 15+.
     */
    adjustMarginsForEdgeToEdge: "force",
  },
  server: {
    // Serving the WebView over https keeps it a secure context, which
    // crypto.randomUUID and IndexedDB both expect.
    androidScheme: "https",
  },
  plugins: {
    /**
     * Routes fetch() through the native HTTP stack instead of the WebView.
     * This is what makes importing work at all: a request to instagram.com
     * from a WebView origin would otherwise be refused by CORS, and recipe
     * sites send no access-control headers to anyone.
     */
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
