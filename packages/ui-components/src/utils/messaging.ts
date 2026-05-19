/** Shared messaging/chat formatting utilities */

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export interface MessageItem {
  id: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export function groupMessagesByDate<T extends { createdAt: string }>(
  messages: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const msg of messages) {
    const dateKey = new Date(msg.createdAt).toDateString();
    const existing = groups.get(dateKey);
    if (existing) {
      existing.push(msg);
    } else {
      groups.set(dateKey, [msg]);
    }
  }
  return groups;
}
