"use client";

import { useState, useEffect, useCallback } from "react";

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    const saved = localStorage.getItem("bui-theme");
    const darkActive = saved !== "light";
    setIsDark(darkActive);
    document.documentElement.classList.toggle("dark", darkActive);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "bui-theme") {
        const nextDark = e.newValue !== "light";
        setIsDark(nextDark);
        document.documentElement.classList.toggle("dark", nextDark);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem("bui-theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      window.dispatchEvent(new Event("cg-theme-change"));
      return next;
    });
  }, []);

  useEffect(() => {
    const onCustom = () => {
      const saved = localStorage.getItem("bui-theme");
      const darkActive = saved !== "light";
      setIsDark(darkActive);
      document.documentElement.classList.toggle("dark", darkActive);
    };
    window.addEventListener("cg-theme-change", onCustom);
    return () => window.removeEventListener("cg-theme-change", onCustom);
  }, []);

  return { isDark, toggleTheme };
}
