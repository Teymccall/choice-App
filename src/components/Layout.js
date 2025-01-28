import React, { useEffect } from 'react';
import Navigation from './Navigation';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase/config';

const Layout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isHomePage = location.pathname === '/';

  // Don't show navigation on login page
  const showNav = user && !isLoginPage;

  // Initialize theme
  useEffect(() => {
    if (!user?.uid) {
      // If no user, check localStorage or use system preference
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme) {
        document.documentElement.classList.toggle('dark', storedTheme === 'dark');
      } else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', isDark);
      }
      return;
    }

    // Listen for theme changes in Firebase
    const themeRef = ref(rtdb, `userSettings/${user.uid}/theme`);
    const unsubscribe = onValue(themeRef, (snapshot) => {
      const data = snapshot.val();
      if (data?.preference) {
        if (data.preference === 'system') {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.classList.toggle('dark', isDark);
          localStorage.removeItem('theme');
        } else {
          document.documentElement.classList.toggle('dark', data.preference === 'dark');
          localStorage.setItem('theme', data.preference);
        }
      }
    });

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e) => {
      const storedTheme = localStorage.getItem('theme');
      if (!storedTheme) {
        document.documentElement.classList.toggle('dark', e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      unsubscribe();
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [user?.uid]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {showNav && <Navigation />}
      <main className={`${showNav ? 'pb-16 sm:pb-0' : ''} ${
        isHomePage 
          ? 'bg-gradient-to-b from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-900/40' 
          : ''
      }`}>
        {children}
      </main>
    </div>
  );
};

export default Layout; 