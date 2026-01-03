export function timeAgo(date: Date) {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return `${interval} years ago`;

  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return `${interval} months ago`;

  interval = Math.floor(seconds / 86400);
  if (interval > 1) return `${interval} days ago`;

  interval = Math.floor(seconds / 3600);
  if (interval > 1) return `${interval} hours ago`;

  interval = Math.floor(seconds / 60);
  if (interval > 1) return `${interval} minutes ago`;

  return `${Math.floor(seconds)} seconds ago`;
}

// Format timestamp (HH:mm if same day, otherwise Thứ X HH:mm)
export function formatTimestamp(date: Date): string {
  const now = new Date();
  const messageDate = new Date(date);

  // Reset time to compare dates only
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(
    messageDate.getFullYear(),
    messageDate.getMonth(),
    messageDate.getDate()
  );

  const isSameDay = nowDate.getTime() === msgDate.getTime();

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const timeStr = `${hours}:${minutes}`;

  // If same day, just return time
  if (isSameDay) {
    return timeStr;
  }

  // Otherwise, include day of week
  const daysOfWeek = [
    "Chủ nhật",
    "Thứ hai",
    "Thứ ba",
    "Thứ tư",
    "Thứ năm",
    "Thứ sáu",
    "Thứ bảy",
  ];
  const dayOfWeek = daysOfWeek[date.getDay()];

  return `${dayOfWeek} ${timeStr}`;
}

// Format simple time (HH:mm) for divider when same day
function formatSimpleTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

// Format timestamp for message divider
export function formatMessageDivider(date: Date): string {
  const now = new Date();
  const messageDate = new Date(date);

  // Reset time to compare dates only
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(
    messageDate.getFullYear(),
    messageDate.getMonth(),
    messageDate.getDate()
  );

  const diffInMs = nowDate.getTime() - msgDate.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  // Same day - just return time
  if (diffInDays === 0) {
    return formatSimpleTime(messageDate);
  }

  // Within 1 week - return day of week
  if (diffInDays < 7) {
    const daysOfWeek = [
      "Chủ nhật",
      "Thứ hai",
      "Thứ ba",
      "Thứ tư",
      "Thứ năm",
      "Thứ sáu",
      "Thứ bảy",
    ];
    return daysOfWeek[messageDate.getDay()];
  }

  // Over 1 week - return date (dd/mm/yyyy)
  const day = messageDate.getDate().toString().padStart(2, "0");
  const month = (messageDate.getMonth() + 1).toString().padStart(2, "0");
  const year = messageDate.getFullYear();
  return `${day}/${month}/${year}`;
}

// Check if two messages should have a divider between them (> 1 hour difference)
export function shouldShowDivider(prevDate: Date, currentDate: Date): boolean {
  const diffInMs = currentDate.getTime() - prevDate.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);
  return diffInHours > 1;
}
