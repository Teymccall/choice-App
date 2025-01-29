import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  UserGroupIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  WifiIcon,
  ClockIcon,
  PlusCircleIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

const ConnectPartner = () => {
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [copied, setCopied] = useState(false);
  const { 
    user, 
    partner, 
    connectPartner, 
    activeInviteCode, 
    generateInviteCode, 
    isOnline,
    setActiveInviteCode,
    disconnectPartner,
    disconnectMessage,
    clearDisconnectMessage
  } = useAuth();

  // Calculate time left for active invite code
  useEffect(() => {
    if (!activeInviteCode) {
      setTimeLeft(null);
      return;
    }

    const updateTimeLeft = () => {
      const now = Date.now();
      const expiresAt = activeInviteCode.expiresAt.toMillis();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        setTimeLeft(null);
        setActiveInviteCode(null); // Clear the active invite code when it expires
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [activeInviteCode, setActiveInviteCode]);

  const handleGenerateCode = async () => {
    setError('');
    setIsLoading(true);
    try {
      await generateInviteCode();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setSuccess(false);

    try {
      await connectPartner(inviteCode);
      setSuccess(true);
      setInviteCode('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeInviteCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const handleDisconnect = async () => {
    setError('');
    setIsLoading(true);
    try {
      await disconnectPartner();
    } catch (err) {
      setError(err.message);
      console.error('Disconnect error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOnline) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-center">
          <WifiIcon className="h-12 w-12 text-gray-400 mx-auto animate-pulse" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">You're Offline</h2>
          <p className="mt-2 text-sm text-gray-600">
            Please check your internet connection to connect with your partner
          </p>
        </div>
      </div>
    );
  }

  if (disconnectMessage) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md animate-fade-in">
        <div className="text-center">
          <XCircleIcon className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Partnership Ended</h2>
          <p className="mt-2 text-sm text-gray-600">{disconnectMessage}</p>
          <button
            onClick={clearDisconnectMessage}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-600 bg-primary-50 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-1.5" />
            Return to Connection
          </button>
        </div>
      </div>
    );
  }

  if (partner) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md animate-fade-in">
        <div className="flex items-center justify-center space-x-4">
          <div className="text-center">
            <UserGroupIcon className="h-8 w-8 text-primary-600 mx-auto" />
            <p className="mt-2 font-medium text-gray-900">{user.displayName}</p>
          </div>
          <div className="flex items-center">
            <div className="h-0.5 w-12 bg-primary-600"></div>
            <CheckCircleIcon className="h-8 w-8 text-green-500 mx-2 animate-bounce" />
            <div className="h-0.5 w-12 bg-primary-600"></div>
          </div>
          <div className="text-center">
            <UserGroupIcon className="h-8 w-8 text-primary-600 mx-auto" />
            <p className="mt-2 font-medium text-gray-900">{partner.displayName}</p>
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-gray-600">
          You are connected with your partner!
        </p>
        {error && (
          <div className="mt-4 flex items-center justify-center text-red-500 text-sm animate-shake">
            <XCircleIcon className="h-5 w-5 mr-1.5" />
            {error}
          </div>
        )}
        <button
          onClick={handleDisconnect}
          disabled={isLoading}
          className="mt-4 w-full flex items-center justify-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-700"></div>
              <span className="ml-2">Disconnecting...</span>
            </div>
          ) : (
            <>
              <XCircleIcon className="h-5 w-5 mr-1.5" />
              Disconnect Partnership
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="text-center mb-6">
        <UserGroupIcon className="h-12 w-12 text-primary-600 mx-auto" />
        <h2 className="mt-4 text-xl font-semibold text-gray-900">Connect with Partner</h2>
        <p className="mt-2 text-sm text-gray-600">
          Enter your partner's invite code to connect
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="inviteCode" className="sr-only">
            Partner's Invite Code
          </label>
          <input
            id="inviteCode"
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="Enter Partner's Invite Code"
            className="block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center uppercase tracking-wider bg-white dark:bg-gray-800 text-black dark:text-gray-100"
            maxLength={6}
          />
        </div>

        {error && (
          <div className="flex items-center justify-center text-red-500 text-sm animate-shake">
            <XCircleIcon className="h-5 w-5 mr-1.5" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center justify-center text-green-500 text-sm animate-bounce">
            <CheckCircleIcon className="h-5 w-5 mr-1.5" />
            Successfully connected!
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || inviteCode.length !== 6}
          className={`w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 ${
            isLoading || inviteCode.length !== 6
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:scale-105 active:scale-95'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span className="ml-2">Connecting...</span>
            </div>
          ) : (
            <div className="flex items-center">
              <span>Connect</span>
              <ArrowRightIcon className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </button>
      </form>

      <div className="mt-8 border-t border-gray-200 pt-6">
        <div className="text-center">
          <h3 className="text-sm font-medium text-gray-900">Your Invite Code</h3>
          {activeInviteCode ? (
            <>
              <div className="mt-1 flex items-center justify-center space-x-2">
                <p className="text-lg font-mono font-bold tracking-wider text-primary-600">
                  {activeInviteCode.code}
                </p>
                <button
                  onClick={handleCopyCode}
                  className="inline-flex items-center p-1.5 text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
                  title="Copy invite code"
                >
                  {copied ? (
                    <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-500 animate-bounce" />
                  ) : (
                    <ClipboardDocumentIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-center text-sm text-gray-500">
                <ClockIcon className="h-4 w-4 mr-1" />
                <span>
                  {timeLeft
                    ? `Expires in ${Math.floor(timeLeft / 60)}:${String(
                        timeLeft % 60
                      ).padStart(2, '0')}`
                    : 'Expired'}
                </span>
              </div>
              {!timeLeft && (
                <button
                  onClick={handleGenerateCode}
                  disabled={isLoading}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-600 bg-primary-50 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 animate-fade-in"
                >
                  <PlusCircleIcon className="h-5 w-5 mr-1.5" />
                  Generate New Code
                </button>
              )}
            </>
          ) : (
            <button
              onClick={handleGenerateCode}
              disabled={isLoading}
              className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-600 bg-primary-50 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
            >
              <PlusCircleIcon className="h-5 w-5 mr-1.5" />
              Generate New Code
            </button>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Share this code with your partner (valid for 5 minutes)
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConnectPartner; 