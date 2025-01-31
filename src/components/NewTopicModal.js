import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { ref, push, set, serverTimestamp } from 'firebase/database';
import { rtdb } from '../firebase/config';

const NewTopicModal = ({ isOpen, onClose }) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, partner, isOnline } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isOnline) {
      setError('You are offline. Please check your internet connection.');
      return;
    }

    if (!user?.uid || !partner?.uid) {
      setError('You must be connected with a partner to create topics.');
      return;
    }

    if (!question.trim()) {
      setError('Please enter a topic question.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const topicsRef = ref(rtdb, 'topics');
      const newTopicRef = push(topicsRef);
      
      const newTopic = {
        question: question.trim(),
        createdBy: user.uid,
        creatorName: user.displayName || 'Anonymous',
        partnerId: partner.uid,
        partnerName: partner.displayName || 'Partner',
        createdAt: serverTimestamp(),
        status: 'active',
        responses: {}
      };

      await set(newTopicRef, newTopic);
      
      // Update last checked time for the current partnership
      localStorage.setItem(`lastChecked_topics_${user.uid}_${partner.uid}`, Date.now().toString());
      
      setQuestion('');
      onClose();
    } catch (err) {
      console.error('Error creating topic:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 relative animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>

        <h2 className="text-2xl font-semibold mb-4">New Topic</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="question" className="block text-sm font-medium text-gray-700 mb-2">
              What would you like to discuss?
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
              rows="4"
              placeholder="Enter your topic question..."
            />
          </div>

          {error && (
            <div className="mb-4 text-red-500 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="mr-3 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Topic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewTopicModal; 
