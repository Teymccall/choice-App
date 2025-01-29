import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ref, get, onValue } from 'firebase/database';
import { rtdb } from '../firebase';

const TopicsList = () => {
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    // Check for open chat in session storage on mount
    const openTopicChatId = sessionStorage.getItem('openTopicChatId');
    if (openTopicChatId) {
      const topicRef = ref(rtdb, `topics/${openTopicChatId}`);
      get(topicRef).then((snapshot) => {
        if (snapshot.exists()) {
          const topicData = snapshot.val();
          setSelectedTopic({
            id: openTopicChatId,
            ...topicData
          });
        }
      });
    }

    // Rest of your existing topics subscription code
    const topicsRef = ref(rtdb, 'topics');
    const unsubscribe = onValue(topicsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const topicsList = Object.entries(data).map(([id, topic]) => ({
          id,
          ...topic
        }));
        setTopics(topicsList);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // ... rest of the component code ...
};

export default TopicsList; 