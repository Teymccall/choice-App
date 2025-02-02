import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cookieManager } from '../utils/cookieManager';
import { 
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { setPersistence, browserLocalPersistence, signInWithEmailAndPassword } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import { auth, rtdb } from '../firebase/config';

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  const [showCookieConsent, setShowCookieConsent] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const { login, signup, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  // Check for cookie consent and saved credentials on mount
  useEffect(() => {
    if (!cookieManager.hasConsent()) {
      setShowCookieConsent(true);
    } else {
      // Only load saved state if user has given consent
      const savedEmail = cookieManager.getSavedEmail();
      const wasRemembered = cookieManager.getRememberMe();
      
      if (savedEmail && wasRemembered) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }
  }, []);

  // Password requirements
  const requirements = [
    { text: 'At least 8 characters', met: password.length >= 8 },
    { text: 'At least one uppercase letter', met: /[A-Z]/.test(password) },
    { text: 'At least one number', met: /[0-9]/.test(password) },
    { text: 'At least one special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');
      setIsConnecting(true);

      // Set persistence to LOCAL before signing in
      await setPersistence(auth, browserLocalPersistence);
      
      // Attempt sign in with retry logic
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          if (userCredential.user) {
            // Check database connection
            const connectedRef = ref(rtdb, '.info/connected');
            await new Promise((resolve, reject) => {
              let resolved = false;
              let cleanup = null;

              // Setup timeout
              const timeoutId = setTimeout(() => {
                if (!resolved) {
                  resolved = true;
                  if (cleanup) cleanup();
                  reject(new Error('Connection timeout'));
                }
              }, 10000);

              // Setup listener
              cleanup = onValue(connectedRef, 
                (snap) => {
                if (!resolved) {
                  resolved = true;
                    clearTimeout(timeoutId);
                    cleanup();
                if (snap.val() === true) {
                  resolve();
                } else {
                  reject(new Error('No connection to database'));
                  }
                }
                },
                (error) => {
                if (!resolved) {
                  resolved = true;
                    clearTimeout(timeoutId);
                    cleanup();
                  reject(error);
                }
                }
              );
            });

            cookieManager.saveAuthState(email, rememberMe);
            cookieManager.recordLastLogin(email);
            navigate('/dashboard');
            return;
          }
        } catch (error) {
          retryCount++;
          if (retryCount === maxRetries) {
            throw error;
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection and try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many login attempts. Please try again later.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (err.message === 'Connection timeout') {
        setError('Connection timed out. Please check your internet and try again.');
      } else if (err.message === 'No connection to database') {
        setError('Unable to connect to the service. Please try again.');
      } else {
        setError('Failed to log in. Please try again.');
      }
      cookieManager.clearAuthState();
    } finally {
      setIsLoading(false);
      setIsConnecting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');
      setIsConnecting(true);

      // Set persistence to LOCAL before signing in
      await setPersistence(auth, browserLocalPersistence);
      
      const user = await signInWithGoogle();
      
      if (user) {
        // Check database connection
        const connectedRef = ref(rtdb, '.info/connected');
        await new Promise((resolve, reject) => {
          let resolved = false;
          let cleanup = null;

          // Setup timeout
          const timeoutId = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              if (cleanup) cleanup();
              reject(new Error('Connection timeout'));
            }
          }, 10000);

          // Setup listener
          cleanup = onValue(connectedRef, 
            (snap) => {
            if (!resolved) {
              resolved = true;
                clearTimeout(timeoutId);
                cleanup();
            if (snap.val() === true) {
              resolve();
            } else {
              reject(new Error('No connection to database'));
              }
            }
            },
            (error) => {
            if (!resolved) {
              resolved = true;
                clearTimeout(timeoutId);
                cleanup();
              reject(error);
            }
            }
          );
        });

        cookieManager.saveAuthState(user.email, rememberMe);
        cookieManager.recordLastLogin(user.email);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Google Sign In error:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.message.includes('user-cancelled')) {
        setError('Sign-in was cancelled. Please try again if you want to sign in with Google.');
      } else if (err.message.includes('IdP')) {
        setError('Google sign-in was declined. You can try again or use email to sign in.');
      } else if (err.message.includes('verify your email')) {
        setSuccess(err.message);
      } else if (err.message === 'Connection timeout') {
        setError('Connection timed out. Please check your internet and try again.');
      } else if (err.message === 'No connection to database') {
        setError('Unable to connect to the service. Please try again.');
      } else {
        setError('Unable to sign in with Google. Please try another sign-in method.');
      }
      cookieManager.clearAuthState();
    } finally {
      setIsLoading(false);
      setIsConnecting(false);
    }
  };

  const toggleMode = () => {
    setIsSignup(!isSignup);
    setError('');
    setSuccess('');
    setPassword('');
    
    // Clear email only if remember me is not checked
    if (!rememberMe) {
      setEmail('');
    }
    setDisplayName('');
  };

  const handleCookieConsent = (accepted) => {
    cookieManager.setConsent(accepted);
    setShowCookieConsent(false);
    
    if (!accepted) {
      // Clear all saved data if cookies are declined
      setRememberMe(false);
      setEmail('');
      cookieManager.clearAuthState();
    }
  };

  const handleRememberMeChange = (e) => {
    const newValue = e.target.checked;
    setRememberMe(newValue);
    
    // Clear saved state if remember me is unchecked
    if (!newValue) {
      cookieManager.clearAuthState();
    }
  };

  return (
    <div className="login-page flex min-h-screen items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="login-card w-full max-w-md space-y-8 rounded-lg p-8 shadow-lg">
          <div className="text-center">
          <img
            className="mx-auto h-12 w-auto"
            src="/choice.png"
            alt="Choice App"
          />
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-primary-600">
            Welcome back
            </h2>
          <p className="mt-2 login-text">
            Don't have an account?{' '}
            <Link to="/signup" className="login-link font-medium">
              Sign up
            </Link>
            </p>
          </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
          className="google-button flex w-full justify-center items-center gap-3 rounded-md px-4 py-2 text-sm font-semibold shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="h-5 w-5"
          />
              Continue with Google
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
            <div className="login-divider w-full border-t"></div>
              </div>
              <div className="relative flex justify-center text-sm">
            <span className="login-text bg-white dark:bg-login-card-bg px-2">
              Or continue with email
            </span>
            </div>
          </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4 rounded-md">
              <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input relative block w-full rounded-md px-3 py-2 text-sm placeholder-gray-500 focus:z-10 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                placeholder="Email address"
              />
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                className="login-input relative block w-full rounded-md px-3 py-2 text-sm placeholder-gray-500 focus:z-10 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={handleRememberMeChange}
                className="login-input h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              <label htmlFor="remember-me" className="login-text ml-2 block text-sm">
                  Remember me
                </label>
              </div>

            <div className="text-sm">
              <Link to="/forgot-password" className="login-link font-medium">
                  Forgot password?
              </Link>
            </div>
            </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

            <button
              type="submit"
              disabled={isLoading}
            className="group relative flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
      </div>
    </div>
  );
} 