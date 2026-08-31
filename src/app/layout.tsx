import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
});

export const metadata: Metadata = {
  title: "Campus Genie — Databricks AI Campus & City Intelligence",
  description:
    "Databricks Lakehouse & Genie Agent powered intelligence for campus life, clubs, labs, alumni pathways, and Bengaluru tech opportunities.",
};

const themeScript = `(function(){try{var t=localStorage.getItem("bui-theme");document.documentElement.classList.toggle("dark",t!=="light")}catch(e){document.documentElement.classList.add("dark")}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.variable} ${mono.variable} font-sans antialiased text-ink bg-stripe-bg`}>
        {children}
      </body>
    </html>
  );
}
