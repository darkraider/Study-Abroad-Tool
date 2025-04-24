// sat/components/layout.ts
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, Sun, Moon, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { DatabaseInitializer } from "@/app/components/DatabaseInitializer";
import Image, { StaticImageData } from 'next/image';
import Link from "next/link";

interface LayoutProps {
  children: React.ReactNode;
  backgroundImageSrc?: StaticImageData | string;
}

export default function Layout({ children, backgroundImageSrc }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { isDarkMode, toggleTheme } = useTheme();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const navigateTo = (path: string) => {
    setMenuOpen(false);
    router.push(path);
  };

  return (
    <>
      <DatabaseInitializer />

      {/* Main Layout Container - Relative positioning context */}
      {/* Removed 'isolate', kept 'relative' for positioning children */}
      {/* Added overflow-hidden to prevent container itself from causing scroll issues */}
      <div className={`relative min-h-screen w-full overflow-hidden bg-transparent text-gray-900 dark:text-gray-100`}>

          {/* --- Background Image Rendered INSIDE main div, but FIRST --- */}
          {backgroundImageSrc && (
            <Image
              src={backgroundImageSrc}
              alt="Page background"
              objectFit="cover"
              className="fixed inset-0 w-full h-full object-cover -z-10 blur-sm pointer-events-none"
              style={{ filter: 'brightness(0.8)' }}
              placeholder="blur"
              priority
            />
          )}

        {/* Top Navigation Bar (Fixed, z-30) */}
        {/* Should position correctly relative to viewport */}
        <nav className={`fixed top-0 left-0 right-0 p-4 flex items-center justify-between shadow-lg z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm`}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400 transition-colors"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
           >
            <Menu size={28} />
          </button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Study Abroad Tool</h1>
           <button
              onClick={toggleTheme}
              className="p-2 w-[40px] h-[40px] flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors"
              disabled={!hasMounted}
              aria-label={hasMounted ? (isDarkMode ? "Switch to light theme" : "Switch to dark theme") : "Toggle theme"}
           >
             {!hasMounted ? (
                <Loader2 size={22} className="animate-spin opacity-50" />
             ) : (
                isDarkMode ? <Sun size={22} /> : <Moon size={22} />
             )}
           </button>
        </nav>

        {/* Hamburger Menu (Fixed, z-40/z-50) */}
        {/* Should position correctly relative to viewport */}
        <AnimatePresence>
          {menuOpen && (
            <>
              {/* Clickable Overlay */}
              <motion.div
                key="menu-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40" // z-40
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
               />
               {/* Menu Panel */}
              <motion.div
                key="menu-panel"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
                // z-50 ensures it's above overlay and nav
                className={`fixed top-0 left-0 h-full w-72 max-w-[80vw] shadow-2xl p-5 z-50 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 flex flex-col`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="menu-heading"
              >
                 {/* Menu Header */}
                <div className="flex justify-between items-center mb-6">
                  <h2 id="menu-heading" className="text-lg font-semibold">Main Menu</h2>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 hover:text-red-600 dark:text-gray-100 dark:hover:text-red-400 transition-colors"
                    aria-label="Close menu"
                   >
                    <X size={28} />
                  </button>
                </div>
                 {/* Menu Items */}
                <ul className="space-y-1 overflow-y-auto flex-grow">
                    <li onClick={() => navigateTo("/")} className={`text-base font-medium cursor-pointer p-3 rounded-lg transition-colors border-b border-gray-200 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400`}>Home</li>
                    <li onClick={() => navigateTo("/budget")} className={`text-base font-medium cursor-pointer p-3 rounded-lg transition-colors border-b border-gray-200 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400`}>Budget</li>
                    <li onClick={() => navigateTo("/savings")} className={`text-base font-medium cursor-pointer p-3 rounded-lg transition-colors border-b border-gray-200 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400`}>Savings Calculator</li>
                    <li onClick={() => navigateTo("/calendar")} className={`text-base font-medium cursor-pointer p-3 rounded-lg transition-colors border-b border-gray-200 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400`}>Calendar</li>
                    <li onClick={() => navigateTo("/scholarshipinfo")} className={`text-base font-medium cursor-pointer p-3 rounded-lg transition-colors border-b border-gray-200 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400`}>Scholarship Info</li>
                    <li onClick={() => navigateTo("/scholarshipplan")} className={`text-base font-medium cursor-pointer p-3 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400`}>Scholarship Planner</li>
                </ul>
                 {/* Menu Footer */}
                <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700/50 text-center text-xs text-gray-500 dark:text-gray-400">
                  Study Abroad Tool v1.1 by <Link rel="noopener noreferrer" target="_blank" href='https://www.linkedin.com/in/moorela/'>Levi Moore</Link>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Page Content Wrapper */}
        {/* Make this the explicit scroll container */}
        {/* Relative z-10 places it above background but below nav/menu */}
        {/* Calculate max-height to account for fixed navbar */}
        <main
         className="relative z-10 px-4 sm:px-6 lg:px-8 overflow-y-auto pt-20 pb-10" 
        >
           {children}
        </main>

      </div> {/* End Main Layout Container */}
    </>
  );
}