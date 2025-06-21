/**
 * Service Worker for EventSentinel
 * Handles push notifications, background sync, and offline capabilities
 */

const CACHE_NAME = "eventsentinel-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/icons/notification-icon.png",
  "/icons/badge-icon.png",
  "/sounds/notification.mp3",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Push event - handle incoming push notifications
self.addEventListener("push", (event) => {
  console.log("Push notification received:", event);

  let notificationData = {
    title: "EventSentinel",
    body: "You have a new message",
    icon: "/icons/notification-icon.png",
    badge: "/icons/badge-icon.png",
    tag: "default",
    data: {},
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = { ...notificationData, ...payload };
    } catch (error) {
      console.error("Error parsing push data:", error);
      notificationData.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: notificationData.data,
    requireInteraction: true,
    actions: [
      {
        action: "open",
        title: "Open Chat",
        icon: "/icons/open-icon.png",
      },
      {
        action: "reply",
        title: "Quick Reply",
        icon: "/icons/reply-icon.png",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(
      notificationData.title,
      notificationOptions
    )
  );
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event);

  event.notification.close();

  const { action } = event;
  const { data } = event.notification;

  if (action === "reply") {
    // Handle quick reply action
    event.waitUntil(handleQuickReply(data));
  } else {
    // Default action - open the app
    event.waitUntil(
      clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clientList) => {
          // Try to focus existing window
          for (const client of clientList) {
            if (client.url.includes(self.location.origin)) {
              // Navigate to specific channel/DM if provided
              if (data.channelId) {
                client.navigate(`/channel/${data.channelId}`);
              } else if (data.directMessageId) {
                client.navigate(`/dm/${data.directMessageId}`);
              }
              return client.focus();
            }
          }

          // Open new window if none exists
          let url = "/";
          if (data.channelId) {
            url = `/channel/${data.channelId}`;
          } else if (data.directMessageId) {
            url = `/dm/${data.directMessageId}`;
          }

          return clients.openWindow(url);
        })
    );
  }

  // Send message to client about notification interaction
  event.waitUntil(
    clients.matchAll().then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({
          type: "NOTIFICATION_CLICKED",
          payload: { action, data },
        });
      });
    })
  );
});

// Notification close event
self.addEventListener("notificationclose", (event) => {
  console.log("Notification closed:", event);

  const { data } = event.notification;

  // Send message to client about notification close
  event.waitUntil(
    clients.matchAll().then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({
          type: "NOTIFICATION_CLOSED",
          payload: { data },
        });
      });
    })
  );
});

// Background sync for offline message sending
self.addEventListener("sync", (event) => {
  console.log("Background sync triggered:", event.tag);

  if (event.tag === "send-messages") {
    event.waitUntil(sendPendingMessages());
  }
});

// Handle quick reply functionality
async function handleQuickReply(data) {
  try {
    // This would typically show a notification with input field
    // For now, we'll just open the app to the relevant conversation
    const clients = await self.clients.matchAll({ type: "window" });

    if (clients.length > 0) {
      const client = clients[0];
      if (data.channelId) {
        client.navigate(`/channel/${data.channelId}`);
      } else if (data.directMessageId) {
        client.navigate(`/dm/${data.directMessageId}`);
      }
      client.focus();
    } else {
      let url = "/";
      if (data.channelId) {
        url = `/channel/${data.channelId}`;
      } else if (data.directMessageId) {
        url = `/dm/${data.directMessageId}`;
      }
      await self.clients.openWindow(url);
    }
  } catch (error) {
    console.error("Error handling quick reply:", error);
  }
}

// Send pending messages when back online
async function sendPendingMessages() {
  try {
    // Get pending messages from IndexedDB
    const pendingMessages = await getPendingMessages();

    for (const message of pendingMessages) {
      try {
        const response = await fetch("/api/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${message.token}`,
          },
          body: JSON.stringify(message.data),
        });

        if (response.ok) {
          // Remove from pending messages
          await removePendingMessage(message.id);
        }
      } catch (error) {
        console.error("Failed to send pending message:", error);
      }
    }
  } catch (error) {
    console.error("Error sending pending messages:", error);
  }
}

// IndexedDB helpers for offline functionality
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("EventSentinelDB", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("pendingMessages")) {
        const store = db.createObjectStore("pendingMessages", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

async function getPendingMessages() {
  const db = await openDB();
  const transaction = db.transaction(["pendingMessages"], "readonly");
  const store = transaction.objectStore("pendingMessages");

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function removePendingMessage(id) {
  const db = await openDB();
  const transaction = db.transaction(["pendingMessages"], "readwrite");
  const store = transaction.objectStore("pendingMessages");

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Fetch event - handle offline requests
self.addEventListener("fetch", (event) => {
  // Only handle GET requests for now
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version if available
      if (response) {
        return response;
      }

      // Otherwise, fetch from network
      return fetch(event.request)
        .then((response) => {
          // Don't cache non-successful responses
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          // Clone the response for caching
          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // Return offline page for navigation requests
          if (event.request.destination === "document") {
            return caches.match("/offline.html");
          }
        });
    })
  );
});

// Message event - handle messages from main thread
self.addEventListener("message", (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case "SKIP_WAITING":
      self.skipWaiting();
      break;
    case "CACHE_URLS":
      event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(payload.urls))
      );
      break;
    default:
      console.log("Unknown message type:", type);
  }
});
