import React from 'react';
import {
  BookOpenIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  CogIcon,
  LightBulbIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

const Manual = () => {
  const sections = [
    {
      title: 'Getting Started',
      icon: LightBulbIcon,
      content: [
        'Create an account or sign in',
        'Generate your unique invite code',
        'Share your invite code with your partner',
        'Wait for your partner to connect using your code',
      ],
    },
    {
      title: 'Connecting with Partner',
      icon: UserGroupIcon,
      content: [
        'Each partner needs their own account',
        'One partner generates and shares their invite code',
        'The other partner enters this code to connect',
        'Once connected, you can start discussing topics',
      ],
    },
    {
      title: 'Managing Topics',
      icon: ChatBubbleLeftRightIcon,
      content: [
        'Create new topics in different categories',
        'Respond to topics with Agree or Disagree',
        'View partner responses after both have answered',
        'Topics are organized by categories for easy navigation',
      ],
    },
    {
      title: 'Viewing Results',
      icon: ChartBarIcon,
      content: [
        'See completed topics and responses',
        'Compare your answers with your partner',
        'Get suggestions based on your responses',
        'Add anonymous notes for discussion',
      ],
    },
    {
      title: 'Settings & Preferences',
      icon: CogIcon,
      content: [
        'Update your profile information',
        'Manage notification preferences',
        'Adjust privacy settings',
        'Control your account settings',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="px-4 py-6 sm:px-0">
          <div className="flex items-center animate-slide-down">
            <BookOpenIcon className="h-8 w-8 text-primary-600 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">User Manual</h1>
              <p className="mt-1 text-sm text-gray-600">
                Learn how to use the app and make the most of its features
              </p>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="px-4 sm:px-0">
          <div className="space-y-8">
            {sections.map((section, index) => (
              <div
                key={section.title}
                className="card transform hover:scale-[1.01] hover:shadow-lg transition-all duration-200 animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start">
                  <section.icon className="h-6 w-6 text-primary-600 mt-1" />
                  <div className="ml-4 flex-1">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {section.title}
                    </h2>
                    <ul className="mt-4 space-y-3">
                      {section.content.map((item, itemIndex) => (
                        <li
                          key={itemIndex}
                          className="flex items-start text-gray-600 animate-slide-up"
                          style={{ animationDelay: `${(index * 4 + itemIndex) * 100}ms` }}
                        >
                          <ArrowRightIcon className="h-5 w-5 text-primary-500 mr-2 flex-shrink-0 transform group-hover:translate-x-1 transition-transform duration-200" />
                          <span className="text-sm">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}

            {/* Tips Section */}
            <div className="card bg-primary-50 transform hover:scale-[1.01] hover:shadow-lg transition-all duration-200 animate-slide-up">
              <div className="flex items-start">
                <CheckCircleIcon className="h-6 w-6 text-primary-600 mt-1" />
                <div className="ml-4">
                  <h2 className="text-xl font-semibold text-gray-900">Pro Tips</h2>
                  <ul className="mt-4 space-y-3">
                    <li className="flex items-center text-sm text-gray-600">
                      <span className="text-primary-500 mr-2">•</span>
                      Take time to think about your responses
                    </li>
                    <li className="flex items-center text-sm text-gray-600">
                      <span className="text-primary-500 mr-2">•</span>
                      Be honest in your answers for better results
                    </li>
                    <li className="flex items-center text-sm text-gray-600">
                      <span className="text-primary-500 mr-2">•</span>
                      Use the notes feature to explain your perspective
                    </li>
                    <li className="flex items-center text-sm text-gray-600">
                      <span className="text-primary-500 mr-2">•</span>
                      Check results regularly to track your progress
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Manual; 