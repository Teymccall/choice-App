import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  
  const { signup, user } = useAuth();
  const navigate = useNavigate();

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

  const handleSignup = async (e) => {
    e.preventDefault();
    
    // Validate password requirements
    if (!requirements.every(req => req.met)) {
      setError('Please meet all password requirements');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      await signup(email, password, displayName);
      navigate('/dashboard');
    } catch (err) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak.');
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center p-4 sm:p-6 lg:p-8 overflow-y-auto bg-white dark:bg-black">
      <div className="w-full max-w-md space-y-6 rounded-lg p-6 shadow-lg bg-white dark:bg-black">
        <div className="text-center">
          <img
            className="mx-auto h-10 w-auto"
            src="/choice.png"
            alt="Choice App"
          />
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-primary-600 dark:text-primary-400">
            Create your account
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">
              Sign in
            </Link>
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSignup}>
          <div className="space-y-3 rounded-md">
            <div>
              <label htmlFor="displayName" className="sr-only">
                Display Name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="relative block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-black px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:z-10 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                placeholder="Display Name"
              />
            </div>
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
                className="relative block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-black px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:z-10 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
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
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocus(true)}
                onBlur={() => setPasswordFocus(false)}
                className="relative block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-black px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:z-10 focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                placeholder="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Password requirements */}
          <div className={`space-y-1 transition-all duration-200 ${passwordFocus ? 'opacity-100' : 'opacity-0'}`}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Password requirements:</p>
            <ul className="space-y-0.5">
              {requirements.map((req, index) => (
                <li
                  key={index}
                  className="flex items-center text-sm"
                >
                  {req.met ? (
                    <CheckIcon className="h-4 w-4 text-green-500 mr-2" />
                  ) : (
                    <XMarkIcon className="h-4 w-4 text-red-500 mr-2" />
                  )}
                  <span className={req.met ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                    {req.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-400">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !requirements.every(req => req.met)}
            className="group relative flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 dark:ring-offset-black"
          >
            {isLoading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>
      </div>
    </div>
  );
} 