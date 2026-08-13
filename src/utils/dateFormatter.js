export const formatNotificationDate = (dateString) => {
  if (!dateString) return "Just now";
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Just now"; // Fallback for invalid date
  
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 172800) return "Yesterday";
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + " " + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true});
};
