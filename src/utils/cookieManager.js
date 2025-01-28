import Cookies from 'js-cookie';

// Cookie names
const COOKIE_NAMES = {
  CONSENT: 'cookieConsent',
  USER_EMAIL: 'userEmail',
  REMEMBER_ME: 'rememberMe',
  AUTH_STATE: 'authState',
  THEME: 'theme',
  LAST_LOGIN: 'lastLogin',
  PREFERENCES: 'userPreferences'
};

// Cookie expiration times (in days)
const EXPIRATION = {
  CONSENT: 365, // 1 year
  USER_EMAIL: 30, // 30 days
  REMEMBER_ME: 30, // 30 days
  AUTH_STATE: 30, // 30 days
  THEME: 90, // 3 months
  LAST_LOGIN: 1, // 1 day
  PREFERENCES: 180 // 6 months
};

// Enhanced security options for cookies
const SECURE_OPTIONS = {
  secure: true, // Only transmitted over HTTPS
  sameSite: 'Strict', // Protect against CSRF
  path: '/' // Available across the site
};

// Set a cookie with proper configuration
const setCookie = (name, value, expiration = null) => {
  const options = { ...SECURE_OPTIONS };
  if (expiration) {
    options.expires = expiration;
  }
  Cookies.set(name, value, options);
};

// Get a cookie value
const getCookie = (name) => {
  return Cookies.get(name);
};

// Remove a specific cookie
const removeCookie = (name) => {
  Cookies.remove(name, { path: '/' });
};

// Remove all auth-related cookies
const removeAuthCookies = () => {
  removeCookie(COOKIE_NAMES.USER_EMAIL);
  removeCookie(COOKIE_NAMES.REMEMBER_ME);
  removeCookie(COOKIE_NAMES.AUTH_STATE);
  removeCookie(COOKIE_NAMES.LAST_LOGIN);
};

// Remove all cookies
const removeAllCookies = () => {
  Object.values(COOKIE_NAMES).forEach(cookieName => {
    removeCookie(cookieName);
  });
};

// Set cookie consent
const setConsent = (accepted) => {
  if (accepted) {
    setCookie(COOKIE_NAMES.CONSENT, 'true', EXPIRATION.CONSENT);
    return true;
  } else {
    removeAllCookies();
    return false;
  }
};

// Check if user has given consent
const hasConsent = () => {
  return getCookie(COOKIE_NAMES.CONSENT) === 'true';
};

// Save authentication state
const saveAuthState = (email, rememberMe = false) => {
  if (!hasConsent()) return;

  if (rememberMe) {
    setCookie(COOKIE_NAMES.USER_EMAIL, email, EXPIRATION.USER_EMAIL);
    setCookie(COOKIE_NAMES.REMEMBER_ME, 'true', EXPIRATION.REMEMBER_ME);
    setCookie(COOKIE_NAMES.AUTH_STATE, 'authenticated', EXPIRATION.AUTH_STATE);
  } else {
    // If remember me is not checked, set session cookies (no expiration)
    setCookie(COOKIE_NAMES.USER_EMAIL, email);
    setCookie(COOKIE_NAMES.AUTH_STATE, 'authenticated');
  }
};

// Clear authentication state
const clearAuthState = () => {
  removeAuthCookies();
};

// Get saved email
const getSavedEmail = () => {
  return getCookie(COOKIE_NAMES.USER_EMAIL);
};

// Check if "Remember Me" was previously selected
const getRememberMe = () => {
  return getCookie(COOKIE_NAMES.REMEMBER_ME) === 'true';
};

// Get authentication state
const getAuthState = () => {
  return getCookie(COOKIE_NAMES.AUTH_STATE) === 'authenticated';
};

// Record last login with additional info
const recordLastLogin = (email, timestamp = new Date().toISOString()) => {
  if (hasConsent()) {
    const loginInfo = JSON.stringify({ email, timestamp });
    setCookie(COOKIE_NAMES.LAST_LOGIN, loginInfo, EXPIRATION.LAST_LOGIN);
  }
};

// Get last login info
const getLastLogin = () => {
  const loginInfo = getCookie(COOKIE_NAMES.LAST_LOGIN);
  try {
    return loginInfo ? JSON.parse(loginInfo) : null;
  } catch {
    return null;
  }
};

// Save user preferences
const savePreferences = (preferences) => {
  if (hasConsent()) {
    setCookie(COOKIE_NAMES.PREFERENCES, JSON.stringify(preferences), EXPIRATION.PREFERENCES);
  }
};

// Get user preferences
const getPreferences = () => {
  const preferences = getCookie(COOKIE_NAMES.PREFERENCES);
  return preferences ? JSON.parse(preferences) : null;
};

// Save theme preference
const saveTheme = (theme) => {
  if (hasConsent()) {
    setCookie(COOKIE_NAMES.THEME, theme, EXPIRATION.THEME);
  }
};

// Get theme preference
const getTheme = () => {
  return getCookie(COOKIE_NAMES.THEME);
};

export const cookieManager = {
  COOKIE_NAMES,
  EXPIRATION,
  setConsent,
  hasConsent,
  saveAuthState,
  clearAuthState,
  getSavedEmail,
  getRememberMe,
  getAuthState,
  recordLastLogin,
  getLastLogin,
  removeAllCookies,
  removeAuthCookies,
  savePreferences,
  getPreferences,
  saveTheme,
  getTheme
};

export default cookieManager; 