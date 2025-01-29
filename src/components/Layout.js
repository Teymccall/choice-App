import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { ref, onValue, get } from 'firebase/database';
import { rtdb } from '../firebase/config';
import FloatingNav from './FloatingNav';
import Navigation from './Navigation';

const Layout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isHomePage = location.pathname === '/';

  // Don't show navigation on login page
  const showNav = user && !isLoginPage;

  // Initialize theme
  useEffect(() => {
    // Initialize theme from Firebase or localStorage
    const initializeTheme = async () => {
      // First check localStorage or system preference regardless of user state
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme) {
        document.documentElement.classList.toggle('dark', storedTheme === 'dark');
      } else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', isDark);
      }

      // If no user, don't proceed with Firebase operations
      if (!user?.uid) return;

      try {
        // Get theme from Firebase
        const themeRef = ref(rtdb, `userSettings/${user.uid}/theme`);
        const snapshot = await get(themeRef);
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
      } catch (error) {
        console.error('Error fetching theme from Firebase:', error);
      }
    };

    initializeTheme();

    // Only set up Firebase listener if user exists
    let unsubscribe;
    if (user?.uid) {
      const themeRef = ref(rtdb, `userSettings/${user.uid}/theme`);
      unsubscribe = onValue(themeRef, (snapshot) => {
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
    }

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
      if (unsubscribe) unsubscribe();
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [user?.uid]);

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