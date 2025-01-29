import React, { createContext, useState, useContext, useEffect } from 'react';
import { 
  doc, 
  collection,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { 
  ref,
  onValue,
  set,
  serverTimestamp as rtdbTimestamp
} from 'firebase/database';
import { db, rtdb } from '../firebase/config';
import { useAuth } from './AuthContext';

const MessageContext = createContext(null);

export const MessageProvider = ({ children }) => {
  const { user, partner } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Message Status Constants
  const MESSAGE_STATUS = {
    SENT: 'sent',
    DELIVERED: 'delivered',
    READ: 'read'
  };

  // Listen for messages and their status changes
  useEffect(() => {
    if (!user?.uid || !partner?.uid) return;

    const messagesRef = collection(db, 'messages');
    const q = query(
      messagesRef,
      where('participants', 'array-contains', user.uid),
      orderBy('timestamp', 'desc')
    );

    // Listen for message changes
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const updatedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(updatedMessages);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to messages:', err);
      setError(err.message);
      setLoading(false);
    });

    // Listen for online status to update delivery status
    const partnerStatusRef = ref(rtdb, `status/${partner.uid}`);
    const unsubscribeStatus = onValue(partnerStatusRef, async (snapshot) => {
      const status = snapshot.val();
      if (status?.state === 'online') {
        // Update undelivered messages to delivered
        const undeliveredMessages = messages.filter(
          msg => msg.senderId === user.uid && msg.status === MESSAGE_STATUS.SENT
        );
        
        for (const msg of undeliveredMessages) {
          await updateDoc(doc(db, 'messages', msg.id), {
            status: MESSAGE_STATUS.DELIVERED,
            deliveredAt: serverTimestamp()
          });
        }
      }
    });

    return () => {
      unsubscribeMessages();
      unsubscribeStatus();
    };
  }, [user?.uid, partner?.uid]);

  // Send a new message
  const sendMessage = async (content) => {
    try {
      if (!user?.uid || !partner?.uid) {
        throw new Error('No active connection');
      }

      const messageData = {
        content,
        senderId: user.uid,
        receiverId: partner.uid,
        participants: [user.uid, partner.uid],
        timestamp: serverTimestamp(),
        status: MESSAGE_STATUS.SENT,
        sentAt: serverTimestamp(),
        deliveredAt: null,
        readAt: null
      };

      const docRef = await addDoc(collection(db, 'messages'), messageData);
      
      // Update RTDB for real-time delivery tracking
      const deliveryRef = ref(rtdb, `messageDelivery/${docRef.id}`);
      await set(deliveryRef, {
        status: MESSAGE_STATUS.SENT,
        timestamp: rtdbTimestamp()
      });

      return docRef.id;
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err.message);
      throw err;
    }
  };

  // Mark messages as read
  const markMessagesAsRead = async (messageIds) => {
    try {
      const batch = [];
      const now = serverTimestamp();

      for (const messageId of messageIds) {
        const messageRef = doc(db, 'messages', messageId);
        batch.push(
          updateDoc(messageRef, {
            status: MESSAGE_STATUS.READ,
            readAt: now
          })
        );

        // Update RTDB for real-time read status
        const deliveryRef = ref(rtdb, `messageDelivery/${messageId}`);
        batch.push(
          set(deliveryRef, {
            status: MESSAGE_STATUS.READ,
            timestamp: rtdbTimestamp()
          })
        );
      }

      await Promise.all(batch);
    } catch (err) {
      console.error('Error marking messages as read:', err);
      setError(err.message);
    }
  };

  // Get message status icon component
  const getMessageStatus = (message) => {
    if (message.senderId !== user?.uid) return null;
    
    switch (message.status) {
      case MESSAGE_STATUS.READ:
        return 'read'; // Two blue ticks
      case MESSAGE_STATUS.DELIVERED:
        return 'delivered'; // Two gray ticks
      case MESSAGE_STATUS.SENT:
        return 'sent'; // One gray tick
      default:
        return 'pending'; // Clock icon
    }
  };

  const value = {
    messages,
    loading,
    error,
    sendMessage,
    markMessagesAsRead,
    getMessageStatus,
    MESSAGE_STATUS
  };

  return (
    <MessageContext.Provider value={value}>
      {children}
    </MessageContext.Provider>
  );
};

export const useMessages = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error('useMessages must be used within a MessageProvider');
  }
  return context;
}; 