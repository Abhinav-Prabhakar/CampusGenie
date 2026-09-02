"use client";

import { useState, useEffect, useCallback } from "react";

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("bui-theme");
      return saved !== "light";
    }
    return true;
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "bui-theme") {
        const nextDark = e.newValue !== "light";
        setIsDark(nextDark);
        document.documentElement.classList.toggle("dark", nextDark);
      }
    };

    const onCustom = () => {
      const saved = localStorage.getItem("bui-theme");
      const darkActive = saved !== "light";
      setIsDark(darkActive);
      document.documentElement.classList.toggle("dark", darkActive);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("cg-theme-change", onCustom);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("cg-theme-change", onCustom);
    };
  }, []);

  const toggleTheme = useCallback(() => {
    const isCurrentlyDark = document.documentElement.classList.contains("dark");
    const nextDark = !isCurrentlyDark;
    localStorage.setItem("bui-theme", nextDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", nextDark);
    setIsDark(nextDark);
    window.dispatchEvent(new Event("cg-theme-change"));
  }, []);

  return { isDark, toggleTheme };
}
