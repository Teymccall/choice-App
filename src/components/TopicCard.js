import React, { useState } from 'react';
import { CheckCircleIcon, HandThumbUpIcon, HandThumbDownIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

const TopicCard = ({ topic, onRespond, onDiscuss, onEdit, onDelete, unreadMessages, onReady }) => {
  const { user, partner } = useAuth();
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState(topic.question);
  const userResponse = topic.responses?.[user?.uid]?.response;
  const partnerResponse = topic.responses?.[partner?.uid]?.response;
  const userReady = topic.readyState?.[user?.uid] || false;
  const partnerReady = topic.readyState?.[partner?.uid] || false;
  const bothReady = userReady && partnerReady;
  const bothResponded = userResponse !== undefined && partnerResponse !== undefined;
  const formattedDate = new Date(topic.createdAt).toLocaleDateString();
  const canEdit = topic.createdBy === user?.uid && !bothResponded;
  const canDelete = topic.createdBy === user?.uid;

  // Add console logging
  console.log('Topic Card Debug:', {
    topicId: topic.id,
    createdBy: topic.createdBy,
    userId: user?.uid,
    isCreator: topic.createdBy === user?.uid,
    canDelete
  });

  const handleEdit = async () => {
    if (editedQuestion.trim() === topic.question || !editedQuestion.trim()) {
      setIsEditing(false);
      setEditedQuestion(topic.question);
      return;
    }

    await onEdit(topic.id, editedQuestion.trim());
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditedQuestion(topic.question);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this topic? This action cannot be undone.')) {
      onDelete(topic.id);
    }
  };

  const getStatusMessage = () => {
    if (!userReady && !partnerReady) {
      return (
        <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
          Click ready when you want to make your choice!
        </div>
      );
    }
    
    if (userReady && !partnerReady) {
      return (
        <div className="flex items-center text-sm text-green-600 dark:text-green-400">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
          Waiting for partner to be ready...
        </div>
      );
    }
    
    if (!userReady && partnerReady) {
      return (
        <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
          Your partner is ready - click ready when you want to decide!
        </div>
      );
    }
    
    if (bothReady && !userResponse && !partnerResponse) {
      return (
        <div className="flex items-center text-sm text-green-600 dark:text-green-400">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
          Both ready - make your choice!
        </div>
      );
    }
    
    if (bothReady && userResponse && !partnerResponse) {
      return (
        <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse" />
          Waiting for partner's decision...
        </div>
      );
    }
    
    if (bothReady && !userResponse && partnerResponse) {
      return (
        <div className="flex items-center text-sm text-green-600 dark:text-green-400">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
          Partner has decided - make your choice!
        </div>
      );
    }
    
    if (bothResponded) {
      return (
        <div className="flex items-center text-sm text-green-600 dark:text-green-400">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
          Both decisions made!
        </div>
      );
    }
    
    return null;
  };

  const handleReadyClick = () => {
    if (onReady) {
      onReady(topic.id, !userReady);
    }
  };

  const handleResponseClick = (response) => {
    if (!bothReady) {
      setError('Both users must be ready before making a decision');
      return;
    }
    
    if (onRespond) {
      onRespond(topic.id, response);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-start justify-between">
        {isEditing ? (
          <div className="flex-1 flex items-center space-x-2">
            <input
              type="text"
              value={editedQuestion}
              onChange={(e) => setEditedQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleEdit}
              autoFocus
              className="flex-1 px-2 py-1 text-lg font-medium bg-transparent border-b-2 border-black dark:border-white focus:outline-none focus:border-primary-500 dark:text-white"
              placeholder="Enter topic question..."
            />
            <button
              onClick={() => {
                setIsEditing(false);
                setEditedQuestion(topic.question);
              }}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex-1 mr-2">
              {topic.question}
            </h3>
            <div className="flex items-center space-x-1 flex-shrink-0">
              {canEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Edit topic"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={handleDelete}
                  className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                  title="Delete topic"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        <span>{formattedDate}</span>
        <span className="mx-2">•</span>
        <span>Created by {topic.createdBy === user?.uid ? 'you' : 'partner'}</span>
      </div>

      <div className="mt-4">
        {getStatusMessage()}
        
        <div className="flex items-center space-x-2 mt-4">
          {!bothResponded && (
            <>
              {!bothReady && (
                <button
                  onClick={() => onReady(topic.id, !userReady)}
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 
                    ${userReady 
                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                    }`}
                >
                  <CheckCircleIcon className="h-4 w-4 mr-1.5" />
                  {userReady ? 'Ready!' : 'Ready?'}
                </button>
              )}
              
              {bothReady && !userResponse && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => onRespond(topic.id, true)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800 transition-colors duration-200"
                  >
                    <HandThumbUpIcon className="h-4 w-4 mr-1.5" />
                    Yes
                  </button>
                  <button
                    onClick={() => onRespond(topic.id, false)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800 transition-colors duration-200"
                  >
                    <HandThumbDownIcon className="h-4 w-4 mr-1.5" />
                    No
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {bothResponded && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Your decision:</span>
                <span className={`text-sm font-medium ${userResponse ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {userResponse ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Partner's decision:</span>
                <span className={`text-sm font-medium ${partnerResponse ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {partnerResponse ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopicCard; 