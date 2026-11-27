import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.midnighttigers.godeye",
  appName: "GodEye",
  webDir: "dist",

  server: {
    hostname: "localhost",
    androidScheme: "https",
  },

  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ["google.com"],
    },
  },
};

export default config;
