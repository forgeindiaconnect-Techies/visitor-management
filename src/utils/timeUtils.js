/**
 * Safely parses a date string ("YYYY-MM-DD") and a 12-hour time string ("10:30 AM") into a JS Date object.
 */
export const parseTimeString = (dateStr, timeStr) => {
  if (!timeStr || !dateStr) return null;
  
  try {
    const timeParts = timeStr.trim().split(' ');
    const time = timeParts[0];
    const period = timeParts.length > 1 ? timeParts[1].toUpperCase() : '';
    
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours);
    minutes = parseInt(minutes) || 0;
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    const pad = (n) => String(n).padStart(2, '0');
    
    const dateTimeStr = `${dateStr}T${pad(hours)}:${pad(minutes)}:00`;
    return new Date(dateTimeStr);
  } catch (e) {
    console.error("Error parsing time string:", e);
    return null;
  }
};

/**
 * Calculates the exact duration a visitor has spent on-site.
 * If status is 'Inside', it calculates dynamically up to current time.
 */
export const calculateTimeSpent = (visitDate, entryTime, exitTime, status) => {
  if (!entryTime || !visitDate) return '-';
  
  const startTime = parseTimeString(visitDate, entryTime);
  if (!startTime) return '-';

  let endTime;
  if (status === 'Inside') {
    endTime = new Date(); // Dynamic live time
  } else if (exitTime) {
    endTime = parseTimeString(visitDate, exitTime);
  } else {
    return '-'; // Needs exit time if not currently inside
  }

  if (!endTime) return '-';

  const diffMs = endTime - startTime;
  if (diffMs < 0) return '0 Sec'; // Negative diff

  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) {
    return diffSecs <= 0 ? '< 1 Min' : `${diffSecs} Sec`;
  }

  const diffMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const minutes = diffMins % 60;

  if (hours > 0) {
    return `${hours} Hr ${minutes} Min`;
  }
  return `${minutes} Min`;
};
