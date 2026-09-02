import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "com.campusgenie.app",
  appName: "Campus Genie",
  webDir: "dist",
  android: { allowMixedContent: false },
  server: {
    url: "https://campus-genie-mobile-7474648667884734.aws.databricksapps.com",
    androidScheme: "https",
    allowNavigation: ["*.databricks.com", "*.databricksapps.com", "campus-genie-ivory.vercel.app"]
  }
};
export default config;
