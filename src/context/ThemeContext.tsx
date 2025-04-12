import React, { createContext, useContext, useState, useEffect } from "react";

// Define the shape of the context value
interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

// Create the context with a default value (adjust default isDarkMode if needed)
const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: true, // Default can be true or based on initial check
  toggleTheme: () => { console.warn("toggleTheme called before Provider mounted"); }, // Default no-op
});

// Custom hook to use the theme context
export const useTheme = () => useContext(ThemeContext);

// Theme Provider component
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {

  // 1. Initialize state: Check localStorage -> System Preference -> Default
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    // Check only on client-side after mount potentially, or handle SSR default
    if (typeof window !== 'undefined') {
      const storedPref = localStorage.getItem("theme");
      if (storedPref) {
        return storedPref === "dark";
      }
      // If no stored preference, check the OS/browser setting
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    // Default theme for SSR or if window is unavailable (e.g., true for dark default)
    return true; // Or false if you prefer light default
  });

  // 2. useEffect to manage the 'dark' class on <html> and localStorage
  useEffect(() => {
    const root = window.document.documentElement; // Get the <html> element

    if (isDarkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
      console.log("Theme set to Dark"); // For debugging
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
       console.log("Theme set to Light"); // For debugging
    }
     // This effect should run whenever isDarkMode changes
  }, [isDarkMode]);

  // 3. Toggle function just updates the state
  const toggleTheme = () => {
    setIsDarkMode(prevMode => !prevMode);
  };

  // Provide the state and toggle function to children
  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};