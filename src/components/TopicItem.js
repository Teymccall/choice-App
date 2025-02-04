import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { CheckCircleIcon, ClockIcon, HandThumbUpIcon, HandThumbDownIcon, ChevronDownIcon, ChevronUpIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';

const TopicItem = ({ topic, onReady, onResponse, onDiscuss, unreadMessages }) => {
  const { user, partner } = useAuth();
  const [showOptions, setShowOptions] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const optionsRef = useRef(null);

  if (!topic || !user || !partner) {
    return null; // Return early if props or context aren't ready
  }

  const hasUserResponded = topic.responses?.[user.uid]?.response !== undefined;
  const hasPartnerResponded = topic.responses?.[partner.uid]?.response !== undefined;
  const isWaitingForPartner = hasUserResponded && !hasPartnerResponded;
  const isWaitingForUser = !hasUserResponded && hasPartnerResponded;
  const bothReady = topic.readyState?.[user.uid] && topic.readyState?.[partner.uid];

  const getStatusDisplay = () => {
    if (topic.status === 'completed') {
      return (
        <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
          <CheckCircleIcon className="h-5 w-5" />
          <span>Completed</span>
        </div>
      );
    }

    if (isWaitingForPartner) {
      return (
        <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400">
          <ClockIcon className="h-5 w-5" />
          <span>Waiting for partner's decision</span>
        </div>
      );
    }

    if (isWaitingForUser) {
      return (
        <div className="flex items-center space-x-1 text-yellow-600 dark:text-yellow-400">
          <ClockIcon className="h-5 w-5" />
          <span>Partner made their decision - your turn!</span>
        </div>
      );
    }

    if (bothReady && !hasUserResponded && !hasPartnerResponded) {
      return (
        <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400">
          <CheckCircleIcon className="h-5 w-5" />
          <span>Both ready - make your decision!</span>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-1 text-gray-600 dark:text-gray-400">
        <ClockIcon className="h-5 w-5" />
        <span>Pending decisions</span>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-[#1f2937] rounded-lg shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {topic.question}
            </h3>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {showDetails ? (
                <ChevronUpIcon className="h-5 w-5" />
              ) : (
                <ChevronDownIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          {showDetails && topic.details && (
            <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm whitespace-pre-wrap">
              {topic.details}
            </p>
          )}
          <div className="mt-2 flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
              {topic.category}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Created by {topic.creatorName}
            </span>
          </div>
          <div className="mt-1">
            {getStatusDisplay()}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {!hasUserResponded && (
            <button
              onClick={() => onReady(topic.id, !topic.readyState?.[user.uid])}
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 
                ${topic.readyState?.[user.uid]
                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                }`}
            >
              <CheckCircleIcon className="h-4 w-4 mr-1.5" />
              {topic.readyState?.[user.uid] ? 'Ready!' : 'Ready?'}
            </button>
          )}
          <button
            onClick={() => onDiscuss(topic.id)}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:hover:bg-purple-800 transition-colors duration-200 relative"
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1.5" />
            Discuss
            {unreadMessages && (
              <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-xs">
                !
              </span>
            )}
          </button>
        </div>

        {!hasUserResponded && bothReady && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onResponse(topic.id, true)}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800 transition-colors duration-200"
            >
              <HandThumbUpIcon className="h-4 w-4 mr-1.5" />
              Yes
            </button>
            <button
              onClick={() => onResponse(topic.id, false)}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800 transition-colors duration-200"
            >
              <HandThumbDownIcon className="h-4 w-4 mr-1.5" />
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopicItem; 