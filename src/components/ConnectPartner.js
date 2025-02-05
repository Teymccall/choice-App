import React, { useState, useEffect, useRef } from 'react';
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
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { Dialog } from '@headlessui/react';
import { Fragment } from 'react';
import { toast } from 'react-hot-toast';

const ConnectPartner = () => {
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
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
    clearDisconnectMessage,
    searchUsers,
    sendPartnerRequest,
    pendingRequests,
    acceptPartnerRequest,
    declinePartnerRequest,
    setPendingRequests,
  } = useAuth();

  const inputRef = useRef(null);
  const searchTimeout = useRef(null);

  // Calculate time left for active invite code
  useEffect(() => {
    if (!activeInviteCode) {
      setTimeLeft(null);
      return;
    }

    const updateTimeLeft = () => {
      const now = Date.now();
      const expiresAt = activeInviteCode.expiresAt instanceof Date 
        ? activeInviteCode.expiresAt.getTime()
        : activeInviteCode.expiresAt.toMillis();
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

  // Focus input when modal opens
  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  }, [isSearchOpen]);

  // Debounced search effect
  useEffect(() => {
    const performSearch = async () => {
      if (searchTerm.length >= 2) {
        setIsSearching(true);
        try {
          const results = await searchUsers(searchTerm);
          setSearchResults(results);
          setSearchError(results.length === 0 ? 'No users found' : '');
        } catch (error) {
          setSearchError(error.message);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setSearchError(searchTerm.length > 0 ? 'Please enter at least 2 characters' : '');
      }
    };

    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchUsers]);

  // Clear search state when modal closes
  useEffect(() => {
    if (!isSearchOpen) {
      setSearchTerm('');
      setSearchResults([]);
      setSearchError('');
      setIsSearching(false);
    }
  }, [isSearchOpen]);

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

  const handleSearch = async () => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchError('Please enter at least 2 characters');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    try {
      const results = await searchUsers(searchTerm);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No users found');
      }
    } catch (error) {
      setSearchError(error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (userId) => {
    setIsLoading(true);
    setError('');
    try {
      await sendPartnerRequest(userId);
      setSuccess(true);
      setIsSearchOpen(false);
      setSearchTerm('');
      setSearchResults([]);
      setSearchError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeclineRequest = async (requestId) => {
    if (!requestId) return;
    
    setIsLoading(true);
    try {
      await declinePartnerRequest(requestId);
      
      // Show success notification
      toast.success('Request declined successfully', {
        duration: 3000,
        position: 'top-center',
      });
    } catch (error) {
      // Show error notification
      toast.error(error.message || 'Failed to decline request', {
        duration: 4000,
        position: 'top-center',
      });
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
      <div className="bg-white dark:bg-black p-4 sm:p-6 rounded-lg shadow-md animate-fade-in">
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center w-full max-w-[300px] space-x-3">
            <div className="text-center flex-1 min-w-0">
              <UserGroupIcon className="h-7 w-7 text-black dark:text-white mx-auto" />
              <p className="mt-1.5 font-medium text-gray-900 dark:text-white text-sm truncate px-1">
                {user.displayName}
              </p>
            </div>
            <div className="flex items-center flex-shrink-0 px-2">
              <div className="h-0.5 w-8 bg-black dark:bg-white"></div>
              <CheckCircleIcon className="h-6 w-6 text-green-500 mx-1.5 animate-bounce" />
              <div className="h-0.5 w-8 bg-black dark:bg-white"></div>
            </div>
            <div className="text-center flex-1 min-w-0">
              <UserGroupIcon className="h-7 w-7 text-black dark:text-white mx-auto" />
              <p className="mt-1.5 font-medium text-gray-900 dark:text-white text-sm truncate px-1">
                {partner.displayName}
              </p>
            </div>
          </div>
          <p className="mt-3 text-center text-sm text-gray-600 dark:text-gray-400">
            You are connected with your partner!
          </p>
          {error && (
            <div className="mt-3 flex items-center justify-center text-red-500 text-sm animate-shake">
              <XCircleIcon className="h-5 w-5 mr-1.5" />
              {error}
            </div>
          )}
          <button
            onClick={handleDisconnect}
            disabled={isLoading}
            className="mt-3 w-full max-w-[300px] flex items-center justify-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-900 dark:text-red-200 dark:border-red-800 dark:hover:bg-red-800"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-700 dark:border-red-200"></div>
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
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="text-center mb-6">
        <UserGroupIcon className="h-12 w-12 text-primary-600 mx-auto" />
        <h2 className="mt-4 text-xl font-semibold text-gray-900">Connect with Partner</h2>
        <p className="mt-2 text-sm text-gray-600">
          Search for a partner or enter their invite code to connect
        </p>
      </div>

      <div className="space-y-6">
        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Pending Requests</h3>
            <div className="space-y-2">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{request.senderName}</p>
                    <p className="text-sm text-gray-500">
                      Expires in {Math.max(0, Math.floor((request.expiresAt.toDate() - new Date()) / 1000 / 60))} minutes
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => acceptPartnerRequest(request.id)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(request.id)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invite Code Section */}
        <div className="space-y-4">
          <div className="flex-1">
            <label htmlFor="inviteCode" className="sr-only">
              Partner's Invite Code
            </label>
            <input
              id="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Enter Partner's Invite Code"
              className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center uppercase tracking-wider"
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
            onClick={handleSubmit}
            disabled={isLoading || inviteCode.length !== 6}
            className={`w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 ${
              isLoading || inviteCode.length !== 6
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:scale-105 active:scale-95'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                <span className="ml-2">Connecting...</span>
              </div>
            ) : (
              <>
                <ArrowRightIcon className="h-5 w-5 mr-1.5" />
                Connect
              </>
            )}
          </button>
        </div>

        {/* Active Invite Code Section */}
        {activeInviteCode && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900">Your Invite Code</p>
              <div className="mt-2 flex items-center justify-center space-x-2">
                <span className="text-2xl font-mono font-bold tracking-wider text-primary-600">
                  {activeInviteCode.code}
                </span>
                <div className="flex space-x-1">
                  <button
                    onClick={handleCopyCode}
                    className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
                    title="Copy code"
                  >
                    {copied ? (
                      <ClipboardDocumentCheckIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <ClipboardDocumentIcon className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={() => setIsSearchOpen(true)}
                    type="button"
                    className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md transition-colors duration-200"
                    title="Search for partners"
                  >
                    <MagnifyingGlassIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
              {timeLeft !== null && (
                <p className="mt-2 text-sm text-gray-500 flex items-center justify-center">
                  <ClockIcon className="h-4 w-4 mr-1" />
                  Expires in {Math.floor(timeLeft / 60)}:{(timeLeft % 60)
                    .toString()
                    .padStart(2, '0')}
                </p>
              )}
            </div>
          </div>
        )}

        {!activeInviteCode && (
          <button
            onClick={handleGenerateCode}
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-600 bg-primary-50 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
          >
            <PlusCircleIcon className="h-5 w-5 mr-1.5" />
            Generate New Code
          </button>
        )}

        {/* Search Modal */}
        <Dialog 
          open={isSearchOpen} 
          onClose={() => setIsSearchOpen(false)}
          className="relative z-10"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" aria-hidden="true" />

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
              <Dialog.Panel className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900"
                >
                  Search for a Partner
                </Dialog.Title>
                <div className="mt-4">
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <input
                        ref={inputRef}
                        id="partnerSearchInput"
                        name="partnerSearch"
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Search by name or email"
                        autoComplete="off"
                        spellCheck="false"
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
                        </div>
                      )}
                    </div>
                  </div>

                  {searchError && (
                    <p className="mt-2 text-sm text-red-600">{searchError}</p>
                  )}

                  <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{result.displayName}</p>
                          <p className="text-sm text-gray-500">{result.email}</p>
                        </div>
                        <button
                          onClick={() => handleSendRequest(result.id)}
                          disabled={isLoading}
                          className="ml-4 px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                        >
                          {isLoading ? 'Sending...' : 'Invite'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
      </div>
    </div>
  );
};

export default ConnectPartner; 