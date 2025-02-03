// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
firebase.initializeApp({
  apiKey: "AIzaSyBl5cdGzFmb4xxz-3inNjUbRI9AKhsw7SE",
  authDomain: "choice-4496c.firebaseapp.com",
  databaseURL: "https://choice-4496c-default-rtdb.firebaseio.com",
  projectId: "choice-4496c",
  storageBucket: "choice-4496c.firebasestorage.app",
  messagingSenderId: "997107815311",
  appId: "1:997107815311:web:056bade42556f933faf1fa"
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  // Default notification options
  const defaultOptions = {
    icon: '/choice.png',
    badge: '/choice.png',
    vibrate: [100, 50, 100], // Vibration pattern for mobile devices
    requireInteraction: true, // Keep notification visible until user interacts
    renotify: true, // Notify even if there's an existing notification
    tag: 'choice-notification', // Group similar notifications
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  // Merge payload with default options
  const notificationOptions = {
    ...defaultOptions,
    body: payload.notification?.body || '',
    title: payload.notification?.title || 'New Message',
    data: payload.data || {},
    tag: payload.data?.type || defaultOptions.tag,
  };

  // Show the notification
  return self.registration.showNotification(
    notificationOptions.title,
    notificationOptions
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  
  // Close the notification
  event.notification.close();
  
  // Handle different actions
  if (event.action === 'dismiss') {
    return; // Just close the notification
  }
  
  // Default action is to open the app
  const urlToOpen = new URL('/', self.location.origin).href;
  
  // Handle the click event
  const promiseChain = clients
    .matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then((windowClients) => {
      // Check if there's already a window/tab open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window/tab is open, open one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    });
  
  event.waitUntil(promiseChain);
}); 