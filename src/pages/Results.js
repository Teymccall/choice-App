import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircleIcon,
  XCircleIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  UserIcon,
  UserGroupIcon,
  LightBulbIcon,
  TagIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { ref, onValue, update, serverTimestamp } from 'firebase/database';
import { rtdb } from '../firebase/config';

const SUGGESTIONS = {
  matched: {
    agree: [
      "Keep up the great communication!",
      "Consider setting regular check-ins to maintain this alignment",
      "Share what's working well with each other",
    ],
    disagree: [
      "You both see room for improvement - that's a great starting point",
      "Consider discussing specific changes you'd both like to see",
      "Set small, achievable goals together",
    ],
  },
  mismatched: [
    "Take time to understand each other's perspective",
    "Consider scheduling a dedicated discussion about this topic",
    "Remember that disagreement is normal and can lead to growth",
    "Try using 'I feel' statements when discussing this topic",
  ],
};

const formatDate = (timestamp) => {
  if (!timestamp) return '';
  // Handle both Realtime DB timestamps (numbers) and Firestore timestamps (objects)
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp.toDate?.() || new Date(timestamp);
  return date.toLocaleDateString();
};

const Results = () => {
  const { user, partner, isOnline } = useAuth();
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalTopics: 0,
    completedTopics: 0,
    pendingTopics: 0,
    matchedTopics: 0,
    agreementRate: 0,
  });

  // Fetch completed topics
  useEffect(() => {
    // Clear results immediately if not connected
    if (!user?.uid || !partner?.uid || !user?.email || !partner?.email || !isOnline) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Create a unique pairing ID using email addresses to ensure consistency across sessions
    const getPairingId = (email1, email2) => {
      return [email1, email2].sort().join('_');
    };

    const currentPairingId = getPairingId(user.email, partner.email);
    const topicsRef = ref(rtdb, 'topics');
    
    const unsubscribe = onValue(topicsRef, (snapshot) => {
      try {
        // If connection is lost during fetch, clear results
        if (!isOnline) {
          setResults([]);
          setLoading(false);
          return;
        }

        const data = snapshot.val();
        if (!data) {
          setResults([]);
          setLoading(false);
          return;
        }

        const completedTopics = !data ? [] : Object.entries(data)
          .map(([id, topic]) => ({
            id,
            ...topic,
            belongsToCurrentPair: topic?.initiatorEmail && topic?.initialPartnerEmail ? 
              getPairingId(topic.initiatorEmail, topic.initialPartnerEmail) === currentPairingId : false,
            matched: topic?.responses?.[user.uid]?.response === topic?.responses?.[partner.uid]?.response
          }))
          .filter(topic => {
            // Only show topics that:
            // 1. Belong to the current pairing (using emails)
            // 2. Have responses from both current users
            // 3. Are completed
            // 4. Connection is still active
            return (
              isOnline &&
              topic?.belongsToCurrentPair &&
              topic?.status === 'completed' &&
              topic?.responses?.[user.uid]?.response &&
              topic?.responses?.[partner.uid]?.response
            );
          })
          .sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));

        setResults(completedTopics);
        setLoading(false);

        // Calculate stats
        const totalTopics = completedTopics.length;
        const completed = completedTopics.length; // All filtered topics are completed
        const pending = Object.values(data)
          .filter(topic => 
            topic?.initiatorEmail && 
            topic?.initialPartnerEmail && 
            getPairingId(topic.initiatorEmail, topic.initialPartnerEmail) === currentPairingId &&
            (!topic?.responses?.[user.uid]?.response || !topic?.responses?.[partner.uid]?.response)
          ).length;
        const matched = completedTopics.filter(topic => topic.matched).length;
        const agreementRate = completed > 0 ? (matched / completed * 100) : 0;

        setStats({
          totalTopics: totalTopics + pending,
          completedTopics: completed,
          pendingTopics: pending,
          matchedTopics: matched,
          agreementRate: agreementRate || 0
        });
      } catch (err) {
        console.error('Error processing results:', err);
        setError(err.message);
        setLoading(false);
      }
    }, (err) => {
      console.error('Error fetching results:', err);
      setError(err.message);
      setLoading(false);
    });

    return () => {
      // Clean up listener and clear results when partner changes or disconnects
      setResults([]);
      unsubscribe();
    };
  }, [user?.uid, user?.email, partner?.uid, partner?.email, isOnline]); // Add isOnline to dependencies

  const handleAddNote = async (resultId) => {
    if (!note.trim() || !isOnline || !partner?.uid || !user?.email || !partner?.email) return;

    setIsSubmitting(true);
    try {
      const topicRef = ref(rtdb, `topics/${resultId}`);
      const noteData = {
        text: note.trim(),
        createdAt: serverTimestamp(),
        isAnonymous: true,
        pairingId: [user.email, partner.email].sort().join('_'), // Use emails for pairing ID
        authorEmail: user.email // Add author's email for reference
      };

      await update(topicRef, {
        notes: {
          [Date.now()]: noteData
        }
      });
      
      setNote('');
    } catch (err) {
      console.error('Error adding note:', err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRandomSuggestions = (result) => {
    const suggestions = result.matched
      ? SUGGESTIONS.matched[result.responses[user.uid].response]
      : SUGGESTIONS.mismatched;
    return suggestions.slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 p-4 rounded-lg">
            <p>Error loading results: {error}</p>
            <button 
              onClick={() => setError(null)}
              className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show message when not connected
  if (!isOnline || !partner?.email) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Not Connected</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Connect with a partner to see your shared topics and results
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 pb-20 sm:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Results & Statistics</h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Track your progress and view insights together
          </p>
        </div>

        {/* Stats Cards - Horizontal Scrolling */}
        <div className="mb-8 overflow-x-auto pb-4">
          <div className="flex space-x-3 min-w-max px-4">
            {/* Total Topics Card */}
            <div className="w-56 bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-transform hover:scale-105">
              <div className="inline-flex p-2 rounded-lg bg-blue-500">
                <ChartBarIcon className="h-5 w-5 text-white" />
              </div>
              <h3 className="mt-3 text-base font-medium text-gray-900 dark:text-white">Total Topics</h3>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalTopics}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Topics created together</p>
            </div>

            {/* Completed Card */}
            <div className="w-56 bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-transform hover:scale-105">
              <div className="inline-flex p-2 rounded-lg bg-green-500">
                <CheckCircleIcon className="h-5 w-5 text-white" />
              </div>
              <h3 className="mt-3 text-base font-medium text-gray-900 dark:text-white">Completed</h3>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{stats.completedTopics}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Decisions made</p>
            </div>

            {/* In Progress Card */}
            <div className="w-56 bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-transform hover:scale-105">
              <div className="inline-flex p-2 rounded-lg bg-yellow-500">
                <ClockIcon className="h-5 w-5 text-white" />
              </div>
              <h3 className="mt-3 text-base font-medium text-gray-900 dark:text-white">In Progress</h3>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{stats.pendingTopics}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Active discussions</p>
              <div className="mt-1 flex space-x-2 text-xs">
                <span className="text-green-600 dark:text-green-400">
                  {stats.matchedTopics} agree{stats.matchedTopics !== 1 ? 's' : ''}
                </span>
                <span className="text-gray-400 dark:text-gray-500">•</span>
                <span className="text-red-600 dark:text-red-400">
                  {stats.totalTopics - stats.matchedTopics} disagree{stats.totalTopics - stats.matchedTopics !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Agreement Rate Card */}
            <div className="w-56 bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-transform hover:scale-105">
              <div className="inline-flex p-2 rounded-lg bg-primary-500">
                <TagIcon className="h-5 w-5 text-white" />
              </div>
              <h3 className="mt-3 text-base font-medium text-gray-900 dark:text-white">Agreement Rate</h3>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{stats.agreementRate.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Overall alignment</p>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="px-4 sm:px-0">
          <div className="space-y-6">
            {results.length > 0 ? (
              results.map((result, index) => {
                const userResponse = result.responses[user.uid]?.response;
                const partnerResponse = result.responses[partner.uid]?.response;
                
                return (
                  <div
                    key={result.id}
                    className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 transform hover:scale-[1.02] hover:shadow-lg transition-all duration-200 animate-slide-up ${
                      selectedResult === result.id ? 'ring-2 ring-primary-500' : ''
                    }`}
                    style={{ animationDelay: `${index * 200}ms` }}
                    onClick={() => setSelectedResult(result.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center group">
                          <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2 text-primary-600 dark:text-primary-400 group-hover:animate-bounce" />
                          {result.question}
                        </h3>
                        <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200">
                            <TagIcon className="h-4 w-4 mr-1" />
                            {result.category}
                          </span>
                          <span className="flex items-center hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200">
                            <UserGroupIcon className="h-4 w-4 mr-1" />
                            {formatDate(result.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className={`px-4 py-2 rounded-full text-sm font-medium inline-flex items-center transform transition-all duration-200 hover:scale-105 ${
                        result.matched
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400'
                      }`}>
                        {result.matched ? (
                          <CheckCircleIcon className="h-5 w-5 mr-1.5 animate-bounce-in" />
                        ) : (
                          <XCircleIcon className="h-5 w-5 mr-1.5 animate-bounce-in" />
                        )}
                        {result.matched ? 'Match' : 'Mismatch'}
                      </div>
                    </div>

                    {/* Responses */}
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200">
                        <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                          <UserIcon className="h-4 w-4 mr-1.5" />
                          Your Response:
                        </p>
                        <p className={`font-medium flex items-center mt-1 ${
                          userResponse === 'agree'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {userResponse === 'agree' ? (
                            <CheckCircleIcon className="h-5 w-5 mr-1.5 animate-bounce-in" />
                          ) : (
                            <XCircleIcon className="h-5 w-5 mr-1.5 animate-bounce-in" />
                          )}
                          {userResponse ? userResponse.charAt(0).toUpperCase() + userResponse.slice(1) : 'No response'}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200">
                        <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                          <UserGroupIcon className="h-4 w-4 mr-1.5" />
                          {partner.displayName || 'Partner'}'s Response:
                        </p>
                        <p className={`font-medium flex items-center mt-1 ${
                          partnerResponse === 'agree'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {partnerResponse === 'agree' ? (
                            <CheckCircleIcon className="h-5 w-5 mr-1.5 animate-bounce-in" />
                          ) : (
                            <XCircleIcon className="h-5 w-5 mr-1.5 animate-bounce-in" />
                          )}
                          {partnerResponse ? partnerResponse.charAt(0).toUpperCase() + partnerResponse.slice(1) : 'No response'}
                        </p>
                      </div>
                    </div>

                    {/* Suggestions */}
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                        <LightBulbIcon className="h-5 w-5 mr-1.5 text-primary-600 dark:text-primary-400 animate-pulse" />
                        Suggestions:
                      </h4>
                      <ul className="mt-2 space-y-2">
                        {getRandomSuggestions(result).map((suggestion, index) => (
                          <li
                            key={index}
                            className="text-sm text-gray-600 dark:text-gray-400 flex items-start hover:text-gray-900 dark:hover:text-gray-200 transition-colors duration-200"
                            style={{ animationDelay: `${index * 100}ms` }}
                          >
                            <span className="text-primary-500 dark:text-primary-400 mr-2 animate-bounce-in">•</span>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Notes Section */}
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                        <ChatBubbleLeftRightIcon className="h-5 w-5 mr-1.5 text-primary-600 dark:text-primary-400" />
                        Anonymous Notes
                      </h4>
                      {result.notes?.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {Object.entries(result.notes).map(([key, note]) => (
                            <li
                              key={key}
                              className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200 animate-slide-up"
                              style={{ animationDelay: `${key * 100}ms` }}
                            >
                              <div className="flex justify-between items-start">
                                <p>{note.text}</p>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {formatDate(note.createdAt)}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No notes yet</p>
                      )}

                      {/* Add Note Form */}
                      <div className="mt-4">
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Add an anonymous note..."
                          className="w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 transition-all duration-200"
                          rows="2"
                          disabled={!isOnline}
                        />
                        <button
                          onClick={() => handleAddNote(result.id)}
                          className={`mt-2 inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transform transition-all duration-200 hover:scale-105 active:scale-95 ${
                            isSubmitting ? 'opacity-75 cursor-wait' : ''
                          } disabled:opacity-50 disabled:hover:scale-100`}
                          disabled={!note.trim() || isSubmitting || !isOnline}
                        >
                          <PaperAirplaneIcon className={`h-5 w-5 mr-1.5 ${
                            isSubmitting ? 'animate-spin' : ''
                          }`} />
                          {isSubmitting ? 'Sending...' : 'Add Note'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No results yet</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Complete some topics together to see your results here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Results; 