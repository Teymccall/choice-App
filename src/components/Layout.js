import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { ref, onValue, get } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { cookieManager } from '../utils/cookieManager';
import FloatingNav from './FloatingNav';
import Navigation from './Navigation';

const Layout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isHomePage = location.pathname === '/';

  // Don't show navigation on login page
  const showNav = user && !isLoginPage;

  useEffect(() => {
    // Initialize theme from Firebase or localStorage
    const initializeTheme = async () => {
      // First check cookies (highest priority)
      const cookieTheme = cookieManager.getTheme();
      
      // Then check localStorage
      const storedTheme = localStorage.getItem('theme');
      
      // Finally check system preference
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      
      // Determine which theme to use (priority: cookie > localStorage > Firebase > system)
      let themeToApply = systemPreference;
      
      if (storedTheme) {
        themeToApply = storedTheme;
      }
      
      if (cookieTheme) {
        themeToApply = cookieTheme;
      }

      // If user is logged in, try to get theme from Firebase
      if (user?.uid) {
        try {
          const themeRef = ref(rtdb, `userSettings/${user.uid}/theme`);
          const snapshot = await get(themeRef);
          const data = snapshot.val();
          
          if (data?.preference) {
            themeToApply = data.preference;
          }
        } catch (error) {
          console.error('Error fetching theme from Firebase:', error);
        }
      }

      // Apply the theme
      applyTheme(themeToApply);
    };

    // Helper function to apply theme
    const applyTheme = (theme) => {
      const root = document.documentElement;
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = theme === 'dark' || (theme === 'system' && isSystemDark);

      // Remove existing theme classes
      root.classList.remove('light', 'dark');
      root.removeAttribute('data-theme');
      
      // Apply new theme
      if (theme === 'system') {
        root.setAttribute('data-theme', 'system');
        root.classList.add(shouldBeDark ? 'dark' : 'light');
      } else {
        root.setAttribute('data-theme', theme);
        root.classList.add(theme);
      }

      // Store in both localStorage and cookies
      localStorage.setItem('theme', theme);
      cookieManager.saveTheme(theme);
    };

    initializeTheme();

    // Set up Firebase listener for theme changes
    let unsubscribe;
    if (user?.uid) {
      const themeRef = ref(rtdb, `userSettings/${user.uid}/theme`);
      unsubscribe = onValue(themeRef, (snapshot) => {
        const data = snapshot.val();
        if (data?.preference) {
          applyTheme(data.preference);
        }
      });
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e) => {
      const currentTheme = localStorage.getItem('theme') || 'system';
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      if (unsubscribe) unsubscribe();
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [user]);

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {showNav && (
        <>
          <Navigation />
          <FloatingNav />
        </>
      )}
      <main 
        className={`
          ${showNav ? 'pt-16 pb-20' : ''} 
          ${isHomePage ? 'bg-gradient-to-b from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-900/40' : ''}
          h-[calc(100vh-4rem)] sm:h-auto sm:min-h-[calc(100vh-4rem)]
          overflow-y-auto sm:overflow-y-visible
        `}
      >
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout; 