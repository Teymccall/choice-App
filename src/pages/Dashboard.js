import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ConnectPartner from '../components/ConnectPartner';
import { useAuth } from '../context/AuthContext';
import { 
  ChartBarIcon, 
  PlusCircleIcon, 
  ClockIcon, 
  CheckCircleIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase/config';

const Dashboard = () => {
  const { user, partner, isOnline } = useAuth();
  const [recentTopics, setRecentTopics] = useState([]);
  const [stats, setStats] = useState({
    totalTopics: 0,
    completedTopics: 0,
    pendingTopics: 0,
    agreementRate: 0,
    matchedTopics: 0
  });

  // Fetch recent topics and stats
  useEffect(() => {
    if (!user?.uid || !partner?.uid || !user?.email || !partner?.email) {
      setStats({
        totalTopics: 0,
        completedTopics: 0,
        pendingTopics: 0,
        agreementRate: 0,
        matchedTopics: 0
      });
      return;
    }

    // Create a unique pairing ID using email addresses
    const getPairingId = (email1, email2) => {
      return [email1, email2].sort().join('_');
    };

    const currentPairingId = getPairingId(user.email, partner.email);
    const topicsRef = ref(rtdb, 'topics');
    
    const unsubscribe = onValue(topicsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setStats({
          totalTopics: 0,
          completedTopics: 0,
          pendingTopics: 0,
          agreementRate: 0,
          matchedTopics: 0
        });
        return;
      }

      // Filter topics for current pairing
      const pairTopics = !data ? [] : Object.values(data).filter(topic => {
        const topicPairingId = topic?.initiatorEmail && topic?.initialPartnerEmail ? 
          getPairingId(topic.initiatorEmail, topic.initialPartnerEmail) : null;
        return topicPairingId === currentPairingId;
      });

      // Calculate stats only for current pairing's topics
      const totalTopics = pairTopics.length;
      const completedTopics = !pairTopics ? 0 : pairTopics.filter(topic => 
        topic?.status === 'completed' && 
        topic?.responses?.[user.uid]?.response &&
        topic?.responses?.[partner.uid]?.response
      ).length;

      const matchedTopics = !pairTopics ? 0 : pairTopics.filter(topic => {
        const responses = topic?.responses || {};
        const userResponse = responses[user.uid]?.response;
        const partnerResponse = responses[partner.uid]?.response;
        return userResponse && partnerResponse && userResponse === partnerResponse;
      }).length;

      const pendingTopics = totalTopics - completedTopics;
      const agreementRate = completedTopics > 0 ? (matchedTopics / completedTopics) * 100 : 0;

      setStats({
        totalTopics,
        completedTopics,
        pendingTopics,
        agreementRate,
        matchedTopics
      });
    });

    // Listen for dashboard refresh events
    const handleRefresh = () => {
      console.log('Dashboard refresh event received');
    };
    window.addEventListener('refreshDashboard', handleRefresh);

    return () => {
      unsubscribe();
      window.removeEventListener('refreshDashboard', handleRefresh);
    };
  }, [user?.uid, user?.email, partner?.uid, partner?.email]);

  const DashboardCard = ({ icon: Icon, title, value, description, color, extraContent }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-transform hover:scale-105">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className={`inline-flex p-3 rounded-lg ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{value}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
          {extraContent}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-16 pb-20 sm:pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome, {user.displayName}!</h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            {partner ? `Making choices with ${partner.displayName}` : "Connect with your partner to get started"}
          </p>
        </div>

        <div className="max-w-lg mx-auto mb-8">
          <ConnectPartner />
        </div>

        {partner && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
              <Link
                to="/topics"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600"
              >
                <PlusCircleIcon className="h-5 w-5 mr-2" />
                New Topic
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                to="/topics"
                className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-primary-600 dark:text-primary-400 mr-3" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Discuss Topics</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">View and respond to topics</p>
                </div>
              </Link>

              <Link
                to="/results"
                className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <ChartBarIcon className="h-6 w-6 text-primary-600 dark:text-primary-400 mr-3" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">View Results</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Track your progress together</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 