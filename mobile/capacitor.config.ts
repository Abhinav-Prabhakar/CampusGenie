import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.campusgenie.app",
  appName: "Campus Genie",
  webDir: "dist",
  android: { allowMixedContent: false },
};
export default config;
