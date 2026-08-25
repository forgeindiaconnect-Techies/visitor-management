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

    const nameCap = detectedName ? detectedName.charAt(0).toUpperCase() + detectedName.slice(1) : (item.visitorName || 'Visitor');

    // 1. Check In & Check Out
    if (
      title?.includes('Checked In') || 
      msg?.includes('checked in') || 
      msg?.includes('has arrived')
    ) {
      title = 'Visitor Checked In';
      msg = `Visitor ${nameCap} has arrived and checked in.`;
    } 
    else if (
      title?.includes('Checked Out') || 
      msg?.includes('checked out')
    ) {
      title = 'Visitor Checked Out';
      msg = `Visitor ${nameCap} has checked out.`;
    }
    // 2. Approved Notifications
    else if (
      title?.includes('Approved') || 
      msg?.includes('approved') || 
      msg?.includes('has been approved')
    ) {
      if (isReturning) {
        title = 'Returning Pre-Booking Approved';
        msg = msg
          .replace(/^Visitor pre-booking for/i, 'Returning visitor pre-booking for')
          .replace(/^New pre-booking for/i, 'Returning visitor pre-booking for')
          .replace(/^New visitor pre-booking for/i, 'Returning visitor pre-booking for');
      } else {
        title = 'Pre-Booking Approved';
        msg = msg
          .replace(/^Returning visitor pre-booking for/i, 'Visitor pre-booking for')
          .replace(/^New visitor pre-booking for/i, 'Visitor pre-booking for');
      }
    }
    // 3. Rejected Notifications
    else if (
      title?.includes('Rejected') || 
      msg?.includes('rejected') || 
      msg?.includes('has been rejected')
    ) {
      if (isReturning) {
        title = 'Returning Pre-Booking Rejected';
        msg = msg
          .replace(/^Visitor pre-booking for/i, 'Returning visitor pre-booking for')
          .replace(/^New pre-booking for/i, 'Returning visitor pre-booking for');
      } else {
        title = 'Pre-Booking Rejected';
      }
    }
    // 4. Rescheduled Notifications
    else if (
      title?.includes('Rescheduled') || 
      title?.includes('Appointment') || 
      msg?.includes('rescheduled')
    ) {
      if (isReturning) {
        title = 'Returning Appointment Rescheduled';
        msg = msg
          .replace(/for visitor/i, 'for returning visitor')
          .replace(/for new visitor/i, 'for returning visitor');
      } else {
        title = 'Appointment Rescheduled';
        msg = msg.replace(/for returning visitor/i, 'for visitor');
      }
    }
    // 5. New Request / Registration Notifications
    else if (isReturning) {
      title = 'A Returning Visitor Request Received';
      msg = `Returning visitor ${nameCap} waiting for approval`;
    } else {
      title = 'A New Visitor Request Received';
      msg = `New visitor ${nameCap} waiting for approval`;
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
