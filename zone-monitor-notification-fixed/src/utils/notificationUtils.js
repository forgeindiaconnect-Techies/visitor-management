/**
 * Utility functions to format and sanitize notification objects
 */

export const cleanMessage = (item) => {
  if (!item || typeof item !== 'object') return item;

  let title = item.title || 'Notification';
  let msg = typeof item.message === 'string' ? item.message : '';

  // Get reliable visitor name if available
  let rawVisitorName = (
    item.visitorName ||
    item.visitor?.visitorName ||
    item.visitor?.fullName ||
    item.fullName ||
    ''
  ).trim();

  // If visitorName was corrupted with common action words, discard the corrupted name
  if (/^(is|has|was|has checked in|has checked out|visitor)$/i.test(rawVisitorName)) {
    rawVisitorName = '';
  }

  // Sanitize known typos or legacy names
  msg = msg
    .replace(/vaideeswari[\.\s]*2007/gi, 'Vaideeswari')
    .replace(/([\w\s]+)\.\s*\d{4}(\s+has|\s+was|\s+is|\.)/gi, (match, p1, p2) => `${p1.trim()}${p2}`);

  // Fix broken sentences: "Has checked out has checked out."
  if (/^Has checked out\s+has checked out\.?$/i.test(msg)) {
    const name = rawVisitorName || 'Visitor';
    title = 'Pre-Booking Checked Out';
    msg = `${name} has checked out.`;
  }
  // Fix broken sentences: "Has checked in has checked in."
  else if (/^Has checked in\s+has checked in\.?$/i.test(msg)) {
    const name = rawVisitorName || 'Visitor';
    title = 'Pre-Booking Checked In';
    msg = `${name} has checked in.`;
  }
  // Fix broken sentences: "Is is waiting for approval."
  else if (/^Is\s+is waiting for approval\.?$/i.test(msg) || /^Visitor\s+is waiting for approval\.?$/i.test(msg)) {
    const name = rawVisitorName || 'Visitor';
    title = item.isReturning || item.returningVisitor ? 'Returning Visitor Request Received' : 'New Pre-Booking';
    msg = `${name} is waiting for approval.`;
  }
  // Fix double prefix: "Visitor pre-booking for X has been approved by Y"
  else if (msg.includes('was approved by') || msg.includes('has been approved by')) {
    title = 'Pre-Booking Approved';
    msg = msg
      .replace(/^(Returning visitor|Visitor|New visitor|New)?\s*pre-booking for\s+/i, '')
      .replace(/\s+has been approved by\s+/i, ' was approved by ');
  }
  // Fix double prefix: "pre-booking for X was rejected by Y"
  else if (msg.includes('was rejected by') || msg.includes('has been rejected by')) {
    title = 'Pre-Booking Rejected';
    msg = msg
      .replace(/^(Returning visitor|Visitor|New visitor|New)?\s*pre-booking for\s+/i, '')
      .replace(/\s+has been rejected by\s+/i, ' was rejected by ');
  }
  // Standardize titles
  else if (/checked out/i.test(msg) || /Checked Out/i.test(title)) {
    title = 'Pre-Booking Checked Out';
  }
  else if (/checked in/i.test(msg) || /Checked In/i.test(title)) {
    title = 'Pre-Booking Checked In';
  }

  return {
    ...item,
    title,
    message: msg
  };
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

  return list.map(item => cleanMessage(item));
};
