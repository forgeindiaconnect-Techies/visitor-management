export const formatNotificationDate = (dateString) => {
  if (!dateString) return "Just now";
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Just now"; // Fallback for invalid date
  
  const dateFormatted = date.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
  
  const timeFormatted = date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });
  
  return `${dateFormatted}, ${timeFormatted}`;
};
