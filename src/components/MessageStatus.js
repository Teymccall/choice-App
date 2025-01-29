import React from 'react';
import { CheckIcon, ClockIcon } from '@heroicons/react/24/outline';
import { CheckIcon as CheckIconSolid } from '@heroicons/react/24/solid';

const MessageStatus = ({ status }) => {
  switch (status) {
    case 'read':
      return (
        <div className="flex space-x-0.5 text-blue-500">
          <CheckIconSolid className="h-4 w-4" />
          <CheckIconSolid className="h-4 w-4 -ml-2" />
        </div>
      );
    case 'delivered':
      return (
        <div className="flex space-x-0.5 text-gray-500">
          <CheckIcon className="h-4 w-4" />
          <CheckIcon className="h-4 w-4 -ml-2" />
        </div>
      );
    case 'sent':
      return (
        <div className="flex text-gray-500">
          <CheckIcon className="h-4 w-4" />
        </div>
      );
    case 'pending':
    default:
      return (
        <div className="flex text-gray-400">
          <ClockIcon className="h-4 w-4" />
        </div>
      );
  }
};

export default MessageStatus; 