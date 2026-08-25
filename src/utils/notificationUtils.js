const cleanMessage = (item, returningNames = new Set()) => {
  if (!item || typeof item !== 'object') return item;
  let msg = item.message;
  if (typeof msg === 'string') {
    msg = msg
      .replace(/vaideeswari[\.\s]*2007/gi, 'Vaideeswari')
      .replace(/([\w\s]+)\.\s*\d{4}(\s+has|\s+was|\s+is|\.)/gi, (match, p1, p2) => `${p1.trim()}${p2}`);

    const dashMatch = msg.match(/^([A-Za-z\s]+)\s*—\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4},?\s*.*)$/);
    if (dashMatch && (item.title?.includes('Reschedule') || item.title?.includes('Appointment'))) {
      const visitorName = item.visitorName || item.visitor?.visitorName || item.visitor?.fullName || 'Visitor';
      msg = `${dashMatch[1].trim()} has rescheduled the appointment for visitor ${visitorName} to ${dashMatch[2]}.`;
    }

    let detectedName = (item.visitorName || item.visitor?.visitorName || item.visitor?.fullName || '').trim().toLowerCase();
    if (!detectedName) {
      const m = msg.match(/(?:for|visitor)\s+([A-Za-z0-9\s]+?)(?:\s+waiting|\s+has\s+been|\s+has\s+arrived|\s+has\s+checked|\s+was|\s+to|\.|$)/i);
      if (m) detectedName = m[1].trim().toLowerCase();
    }

    let title = item.title;
    const isReturning = Boolean(
      item.isReturning || 
      item.returningVisitor || 
      title?.toLowerCase().includes('returning') || 
      msg.toLowerCase().includes('returning') ||
      (detectedName && returningNames.has(detectedName))
    );

    if (
      title?.includes('Checked In') || 
      msg?.includes('checked in') || 
      msg?.includes('has arrived')
    ) {
      const nameCap = detectedName ? detectedName.charAt(0).toUpperCase() + detectedName.slice(1) : (item.visitorName || 'Visitor');
      title = 'Visitor Checked In';
      msg = `Visitor ${nameCap} has arrived and checked in.`;
    } 
    else if (
      title?.includes('Checked Out') || 
      msg?.includes('checked out')
    ) {
      const nameCap = detectedName ? detectedName.charAt(0).toUpperCase() + detectedName.slice(1) : (item.visitorName || 'Visitor');
      title = 'Visitor Checked Out';
      msg = `Visitor ${nameCap} has checked out.`;
    }
    else if (isReturning) {
      if (title === 'New Pre-Booking') title = 'Returning Pre-Booking';
      else if (title === 'Pre-Booking Approved' || title === 'New Pre-Booking Approved') title = 'Returning Pre-Booking Approved';
      else if (title === 'Pre-Booking Rejected') title = 'Returning Pre-Booking Rejected';
      else if (title === 'Appointment Rescheduled') title = 'Returning Appointment Rescheduled';

      msg = msg
        .replace(/^New visitor/i, 'Returning visitor')
        .replace(/^Visitor pre-booking for/i, 'Returning visitor pre-booking for')
        .replace(/^New pre-booking for/i, 'Returning visitor pre-booking for')
        .replace(/for visitor/i, 'for returning visitor');
    } else {
      if (title === 'Returning Pre-Booking') title = 'New Pre-Booking';
      else if (title === 'Returning Pre-Booking Approved') title = 'Pre-Booking Approved';
      else if (title === 'Returning Appointment Rescheduled') title = 'Appointment Rescheduled';

      msg = msg
        .replace(/^Returning visitor pre-booking for/i, 'Visitor pre-booking for')
        .replace(/^Returning visitor/i, 'Visitor')
        .replace(/for returning visitor/i, 'for visitor');
    }

    return {
      ...item,
      title,
      message: msg
    };
  }
  return item;
};

export const normalizeNotifications = (value) => {
  let list = [];
  if (Array.isArray(value)) {
    list = value;
  } else if (Array.isArray(value?.notifications)) {
    list = value.notifications;
  } else if (Array.isArray(value?.data?.notifications)) {
    list = value.data.notifications;
  }

  // Gather all returning visitor names
  const returningNames = new Set();
  const visitorOccurrences = {};

  for (const item of list) {
    if (!item) continue;
    const msg = typeof item.message === 'string' ? item.message : '';
    const title = typeof item.title === 'string' ? item.title : '';

    let vName = (item.visitorName || item.visitor?.visitorName || item.visitor?.fullName || '').trim().toLowerCase();
    if (!vName && msg) {
      const m = msg.match(/(?:for|visitor)\s+([A-Za-z0-9\s]+?)(?:\s+waiting|\s+has\s+been|\s+has\s+arrived|\s+has\s+checked|\s+was|\s+to|\.|$)/i);
      if (m) vName = m[1].trim().toLowerCase();
    }

    if (vName) {
      visitorOccurrences[vName] = (visitorOccurrences[vName] || 0) + 1;
      if (
        item.isReturning || 
        item.returningVisitor || 
        title.toLowerCase().includes('returning') || 
        msg.toLowerCase().includes('returning')
      ) {
        returningNames.add(vName);
      }
    }
  }

  for (const [name, count] of Object.entries(visitorOccurrences)) {
    if (count > 1) {
      returningNames.add(name);
    }
  }

  return list.map(item => cleanMessage(item, returningNames));
};
