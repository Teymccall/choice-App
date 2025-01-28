import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
  HeartIcon,
  ShieldCheckIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';

const Home = () => {
  const { user } = useAuth();

  const features = [
    {
      icon: UserGroupIcon,
      title: "Private Connection",
      description: "Connect securely with your partner using a unique invite code"
    },
    {
      icon: ShieldCheckIcon,
      title: "Safe Space",
      description: "Discuss sensitive topics in a protected environment"
    },
    {
      icon: LockClosedIcon,
      title: "Anonymous Responses",
      description: "Share your thoughts honestly without immediate influence"
    },
    {
      icon: ChartBarIcon,
      title: "Clear Results",
      description: "See where you align and what needs discussion"
    }
  ];

  const steps = [
    {
      number: "1",
      title: "Create an account or sign in",
      description: "Get started with a secure personal account"
    },
    {
      number: "2",
      title: "Connect with your partner",
      description: "Use a unique invite code to establish a private connection"
    },
    {
      number: "3",
      title: "Respond to topics",
      description: "Share your thoughts on important matters"
    },
    {
      number: "4",
      title: "View results together",
      description: "Discover areas of agreement and topics for discussion"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <HeartIcon className="h-16 w-16 text-primary-600 animate-pulse" />
              <div className="absolute -top-2 -right-2 h-6 w-6 bg-primary-500 rounded-full animate-bounce flex items-center justify-center">
                <span className="text-white text-xs font-bold">!</span>
              </div>
            </div>
          </div>
          
          <h1 className="text-5xl font-bold text-gray-900 mb-6 animate-slide-down">
            Welcome to <span className="text-primary-600">Choice</span>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12 animate-slide-up">
            A safe space for couples to explore and discuss sensitive topics together,
            fostering better understanding and stronger relationships.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 animate-bounce-in">
            {!user ? (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-full shadow-lg text-white bg-primary-600 hover:bg-primary-700 transform transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  Get Started
                  <svg className="ml-3 -mr-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center px-8 py-4 border-2 border-primary-600 text-lg font-medium rounded-full text-primary-600 hover:bg-primary-50 transform transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  Learn More
                </Link>
              </>
            ) : (
              <Link
                to="/dashboard"
                className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-full shadow-lg text-white bg-primary-600 hover:bg-primary-700 transform transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Go to Dashboard
                <svg className="ml-3 -mr-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="bg-white rounded-xl shadow-lg p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How It Works
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="relative animate-slide-up"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div className="bg-white rounded-lg shadow-lg p-6 relative z-10">
                  <div className="absolute -top-4 -left-4 w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-600">
                    {step.description}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 left-full w-full h-0.5 bg-primary-200 transform -translate-y-1/2" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-primary-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6 animate-slide-up">
            Ready to strengthen your relationship?
          </h2>
          <p className="text-xl mb-8 opacity-90 animate-slide-up" style={{ animationDelay: '100ms' }}>
            Start making better decisions together today.
          </p>
          <Link
            to={user ? "/dashboard" : "/login"}
            className="inline-flex items-center px-8 py-4 border-2 border-white text-lg font-medium rounded-full text-primary-600 bg-white hover:bg-primary-50 transform transition-all duration-200 hover:scale-105 active:scale-95 animate-bounce-in"
            style={{ animationDelay: '200ms' }}
          >
            {user ? "Go to Dashboard" : "Get Started Now"}
            <svg className="ml-3 -mr-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home; 