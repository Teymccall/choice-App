import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (isSignup) {
        if (!requirements.every(req => req.met)) {
          throw new Error('Please meet all password requirements');
        }
        await signup(email, password, displayName);
        setSuccess('Account created! Please check your email to verify your account.');
      } else {
        const user = await login(email, password);
        
        // Save auth state if login successful
        if (user) {
          cookieManager.saveAuthState(email, rememberMe);
          cookieManager.recordLastLogin(email);
          navigate('/dashboard');
        }
      }
    } catch (err) {
      if (err.code === 'auth/account-exists-with-different-credential' || 
          err.code === 'auth/user-not-found' || 
          err.code === 'auth/wrong-password') {
        setError(
          'If you originally signed up with Google, please use the "Continue with Google" button above to sign in.'
        );
      } else if (err.message.includes('verify your email')) {
        setSuccess(err.message);
      } else {
        setError(err.message);
      }
      
        // Clear saved state on error
        if (!isSignup) {
          cookieManager.clearAuthState();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError('');
      setSuccess('');
      const user = await signInWithGoogle();
      
      if (user) {
        cookieManager.saveAuthState(user.email, rememberMe);
        cookieManager.recordLastLogin(user.email);
        navigate('/dashboard');
      }
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.message.includes('user-cancelled')) {
        setError('Sign-in was cancelled. Please try again if you want to sign in with Google.');
      } else if (err.message.includes('IdP')) {
        setError('Google sign-in was declined. You can try again or use email to sign in.');
      } else if (err.message.includes('verify your email')) {
        setSuccess(err.message);
      } else {
        setError('Unable to sign in with Google. Please try another sign-in method.');
      }
      cookieManager.clearAuthState();
    } finally {
      setIsLoading(false);
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Cookie Consent Banner */}
        {showCookieConsent && (
          <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4 md:p-6 mx-4 mb-4 rounded-lg">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  We use cookies to enhance your experience and remember your preferences. 
                  By continuing to use this site, you agree to our use of cookies.
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleCookieConsent(false)}
                  className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                >
                  Decline
                </button>
                <button
                  onClick={() => handleCookieConsent(true)}
                  className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700"
                >
                  Accept
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Logo and Title */}
        <div className="text-center mb-8">
          <img src="/choice.png" alt="Choice Logo" className="h-12 w-auto mx-auto mb-3" />
          <p className="text-gray-600">Make decisions together</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-xl p-8 space-y-6 transition-all duration-300">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-sm text-gray-600">
              {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={toggleMode}
                className="font-medium text-primary-600 hover:text-primary-500 transition-colors"
              >
                {isSignup ? 'Sign in' : 'Sign up'}
              </button>
            </p>
          </div>

          {success && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-5 w-5 text-green-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800">{success}</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 shadow-sm">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <XCircleIcon className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3 w-full">
                  <div className="flex justify-between items-start">
                    <p className="text-sm text-red-800 font-medium">Sign-in Error</p>
                    <button 
                      onClick={() => setError('')}
                      className="ml-2 inline-flex text-gray-400 hover:text-gray-500"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                  {error.includes('Google sign-in') && (
                    <div className="mt-2 flex items-center space-x-2">
                      <div className="h-px flex-1 bg-red-100"></div>
                      <span className="text-xs text-red-600 px-2">Available Options</span>
                      <div className="h-px flex-1 bg-red-100"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Google Sign In Button */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with email</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required={isSignup}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  placeholder="How should we call you?"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  placeholder={isSignup ? 'Create a strong password' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocus(true)}
                  onBlur={() => setPasswordFocus(false)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            {isSignup && (passwordFocus || password.length > 0) && (
              <div className="space-y-2 text-sm">
                <p className="font-medium text-gray-700">Password requirements:</p>
                <div className="grid grid-cols-1 gap-2">
                  {requirements.map((req, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      {req.met ? (
                        <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircleIcon className="h-4 w-4 text-gray-300" />
                      )}
                      <span className={req.met ? 'text-green-700' : 'text-gray-500'}>
                        {req.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={handleRememberMeChange}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>
              {!isSignup && (
                <button
                  type="button"
                  onClick={() => {/* Add forgot password handler */}}
                  className="text-sm font-medium text-primary-600 hover:text-primary-500"
                >
                  Forgot password?
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200 ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <ArrowRightIcon className="h-5 w-5 animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span>{isSignup ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRightIcon className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </button>
          </form>
        </div>

        {/* Trust indicators */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            By continuing, you agree to our{' '}
            <a href="#" className="text-primary-600 hover:text-primary-500">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-primary-600 hover:text-primary-500">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
} 