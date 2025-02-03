import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      await resetPassword(email);
      setSuccess(true);
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else {
        setError('Failed to send password reset email. Please try again.');
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
            Reset your password
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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

          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
              <div className="flex">
                <XCircleIcon className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-400">{error}</h3>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3">
              <div className="flex">
                <CheckCircleIcon className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-400">
                    Password reset email sent! Check your inbox for further instructions.
                  </h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 dark:ring-offset-black"
            >
              {isLoading ? 'Sending...' : 'Send reset link'}
            </button>
          </div>

          <div className="text-center">
            <Link
              to="/login"
              className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
            >
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
} 