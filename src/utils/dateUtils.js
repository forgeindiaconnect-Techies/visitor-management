export const formatDisplayTime = (timeVal) => {
  if (!timeVal || timeVal === '-' || timeVal === 'N/A') return 'N/A';
  
  // If it's a Date instance or ISO/Date string containing T, -, or /
  if (timeVal instanceof Date || (typeof timeVal === 'string' && (timeVal.includes('T') || timeVal.includes('-') || timeVal.includes('/')) && !isNaN(new Date(timeVal).getTime()))) {
    const d = new Date(timeVal);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }

  // If it's a string
  if (typeof timeVal === 'string') {
    const str = timeVal.trim();
    // Handle "HH:MM:SS AM/PM" or "HH:MM AM/PM" or "H:M am/pm"
    const match12 = str.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([a-zA-Z]{2})$/i);
    if (match12) {
      const h = match12[1].padStart(2, '0');
      const m = match12[2];
      const period = match12[3].toUpperCase();
      return `${h}:${m} ${period}`;
    }

    // Handle "HH:MM:SS" or "HH:MM" (24-hour format)
    const match24 = str.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
    if (match24) {
      let hours = parseInt(match24[1], 10);
      const minutes = match24[2];
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${String(hours).padStart(2, '0')}:${minutes} ${period}`;
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    return str;
  }

  return 'N/A';
};

export const formatDisplayDateTime = (dateVal) => {
  if (!dateVal || dateVal === '-' || dateVal === 'N/A') return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${dateStr}, ${timeStr}`;
};

export const formatDisplayDate = (dateVal) => {
  if (!dateVal || dateVal === '-' || dateVal === 'N/A') return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatAppointmentDate = formatDisplayDate;
export const formatAppointmentTime = formatDisplayTime;


