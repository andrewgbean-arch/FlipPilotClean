import React, { createContext, useContext, useState } from "react";

export type DealerNotification = {
  id: string;
  type: "MOT" | "SALE" | "STOCK" | "SYSTEM";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

type DealerNotificationsContextValue = {
  notifications: DealerNotification[];
  addNotification: (
    n: Omit<DealerNotification, "id" | "createdAt" | "read">
  ) => void;
  markRead: (id: string) => void;
  clearAll: () => void;

  // ⭐ NEW — grouped notifications
  groupedNotifications: () => {
    type: DealerNotification["type"];
    count: number;
    latest: DealerNotification;
  }[];
};

const DealerNotificationsContext =
  createContext<DealerNotificationsContextValue | null>(null);

// Notifications only live for the session, so keep the list from growing
// without limit.
const MAX_NOTIFICATIONS = 100;

export function DealerNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<DealerNotification[]>([]);

  const addNotification: DealerNotificationsContextValue["addNotification"] = (
    n
  ) => {
    const entry: DealerNotification = {
      id: Math.random().toString(36).slice(2),
      createdAt: new Date().toISOString(),
      read: false,
      ...n,
    };

    setNotifications((prev) => {
      // Something already saying exactly this is still waiting to be read
      // (for example the MOT alerts screen adds its notifications every time
      // it opens), so there is nothing new to tell the user.
      const repeat = prev.some(
        (x) =>
          !x.read &&
          x.type === entry.type &&
          x.title === entry.title &&
          x.message === entry.message
      );
      if (repeat) return prev;

      return [entry, ...prev].slice(0, MAX_NOTIFICATIONS);
    });
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const clearAll = () => setNotifications([]);

  // ⭐ NEW — grouping logic
  const groupedNotifications = () => {
    const groups: Record<
      string,
      {
        type: DealerNotification["type"];
        count: number;
        latest: DealerNotification;
      }
    > = {};

    notifications.forEach((n) => {
      const key = n.type;

      if (!groups[key]) {
        groups[key] = {
          type: key,
          count: 0,
          latest: n,
        };
      }

      groups[key].count += 1;

      // keep newest notification as preview
      if (
        new Date(n.createdAt).getTime() >
        new Date(groups[key].latest.createdAt).getTime()
      ) {
        groups[key].latest = n;
      }
    });

    return Object.values(groups);
  };

  return (
    <DealerNotificationsContext.Provider
      value={{
        notifications,
        addNotification,
        markRead,
        clearAll,
        groupedNotifications, // ⭐ exposed
      }}
    >
      {children}
    </DealerNotificationsContext.Provider>
  );
}

export function useDealerNotifications() {
  const ctx = useContext(DealerNotificationsContext);
  if (!ctx) {
    throw new Error(
      "useDealerNotifications must be used within DealerNotificationsProvider"
    );
  }
  return ctx;
}
