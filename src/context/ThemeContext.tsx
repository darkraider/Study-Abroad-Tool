// ThemeContext.ts

import React, { createContext, useContext, useState, useEffect } from 'react'

// Define the shape of the context value
interface ThemeContextType {
  isDarkMode: boolean
  toggleTheme: () => void
}

// Create the context with a default value
// The actual default is determined by useState initializer below
const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: true, // Initial context default (less important)
  toggleTheme: () => {
    console.warn('toggleTheme called before Provider mounted')
  }
})

// Custom hook to use the theme context
export const useTheme = () => useContext(ThemeContext)

// Theme Provider component
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // 1. Initialize state: Check localStorage -> Default to Dark
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    // Check only on client-side
    if (typeof window !== 'undefined') {
      const storedPref = localStorage.getItem('theme')
      if (storedPref) {
        // If a theme is stored, use it
        return storedPref === 'dark'
      }
      // If NO theme is stored in localStorage, default to DARK
      // We are bypassing the system preference check here for the initial default
      return true // <-- Set default to dark
    }
    // Default theme for SSR or if window is unavailable (e.g., true for dark default)
    // Ensures server render matches the default client intent
    return true // <-- Also set default to dark for SSR/initial render
  })

  // 2. useEffect to manage the 'dark' class on <html> and localStorage (No change needed here)
  useEffect(() => {
    const root = window.document.documentElement

    if (isDarkMode) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      // console.log("Theme set to Dark");
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      // console.log("Theme set to Light");
    }
  }, [isDarkMode])

  // 3. Toggle function (No change needed here)
  const toggleTheme = () => {
    setIsDarkMode(prevMode => !prevMode)
  }

  // Provide the state and toggle function to children
  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
