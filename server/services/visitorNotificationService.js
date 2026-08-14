const Notification = require('../models/Notification');
const User = require('../models/User');
const emailService = require('../utils/emailService');

const EVENTS = {
  VISITOR_REGISTERED: 'VISITOR_REGISTERED',
  VISITOR_APPROVED: 'VISITOR_APPROVED',
  VISITOR_REJECTED: 'VISITOR_REJECTED',
  APPOINTMENT_RESCHEDULED: 'APPOINTMENT_RESCHEDULED', // Covers date/time changes
  VISITOR_CANCELLED: 'VISITOR_CANCELLED',
  VISITOR_CHECKED_IN: 'VISITOR_CHECKED_IN',
  VISITOR_CHECKED_OUT: 'VISITOR_CHECKED_OUT'
};

const notifyVisitorStatusChange = async ({
  visitor,
  event,
  changedBy,
  reason,
  historyEntry = null,
  io = null // pass socket instance if available in req, else we might not emit here
}) => {
  try {
    let emailSubject = 'Visitor Status Update';
    let emailHtml = '';
    let notificationTitle = 'Visitor Update';
    let notificationMessage = '';
    let sendToVisitorEmail = false;

    // Base info for email
    const generateEmailHeader = (subject) => `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>${subject}</h2>
        <p>Visitor: <b>${visitor.visitorName || visitor.fullName || 'N/A'}</b></p>
        <p>Host: <b>${visitor.hostName || visitor.hostEmployee || 'N/A'}</b></p>
    `;
    const generateEmailFooter = () => `</div>`;
    const trackingUrl = visitor.trackingToken
      ? `${process.env.FRONTEND_URL || 'http://localhost:5173'}/visitor-status/${visitor.trackingToken}`
      : `${process.env.FRONTEND_URL || 'http://localhost:5173'}/visitor-status/${visitor._id}`;
    const actionLink = `<p><br/><a href="${trackingUrl}" style="padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">Track My Visit</a></p>`;

    switch (event) {
      case EVENTS.VISITOR_REGISTERED:
        emailSubject = 'Pre-Booking Request Submitted';
        emailHtml = generateEmailHeader(emailSubject) +
          `<p>Your visitor appointment request has been successfully submitted.</p>
           <p>Status: <b>Pending Approval</b></p>` + actionLink + generateEmailFooter();
        notificationTitle = 'Pre-Booking Submitted';
        notificationMessage = `🔔 Pre-Booking Submitted\nYour visitor request from ${visitor.visitorName || visitor.fullName} is waiting for approval.`;
        sendToVisitorEmail = true;
        break;

      case EVENTS.VISITOR_APPROVED:
        emailSubject = 'Visitor Appointment Approved ✔';
        const approvedByName = changedBy?.name || 'Authorized Personnel';
        const approvedByRole = changedBy?.role || 'Admin';
        const visitDateFormatted = visitor.visitDate ? new Date(visitor.visitDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : (visitor.visitDate || 'TBD');
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="background-color: #16a34a; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="margin: 0; font-size: 20px;">&#10004; Appointment Approved</h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff;">
              <p style="font-size: 16px; color: #1e293b;">Hello <strong>${visitor.visitorName || visitor.fullName || 'Visitor'}</strong>,</p>
              <p style="font-size: 14px; color: #475569;">Your visitor appointment has been approved.</p>
              <div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 4px 0; font-size: 14px;"><strong>Approved By:</strong> ${approvedByName}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Role:</strong> ${approvedByRole}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Appointment Date:</strong> ${visitDateFormatted}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Appointment Time:</strong> ${visitor.expectedArrivalTime || visitor.expectedTime || 'TBD'} ${(visitor.appointmentEndTime) ? '- ' + visitor.appointmentEndTime : ''}</p>
              </div>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${trackingUrl}" target="_blank" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; margin: 4px;">VIEW APPOINTMENT</a>
                <a href="${trackingUrl}" target="_blank" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; margin: 4px;">VIEW QR PASS</a>
              </div>
              <p style="font-size: 13px; color: #64748b;">Please show your QR Pass at the security gate upon arrival.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="font-size: 14px; color: #1e293b; margin: 0;">Thank You,<br/><strong>FIC Visitor Management</strong></p>
            </div>
          </div>
        `;
        notificationTitle = 'Visitor Approved';
        notificationMessage = `Your visitor appointment with ${visitor.visitorName || visitor.fullName} has been approved.`;
        sendToVisitorEmail = true;
        break;

      case EVENTS.VISITOR_REJECTED:
        emailSubject = 'Visitor Request Rejected';
        emailHtml = generateEmailHeader(emailSubject) +
          `<p>Your appointment request has been rejected.</p>` +
          (reason ? `<p>Reason: <b>${reason}</b></p>` : '') + generateEmailFooter();
        notificationTitle = 'Visitor Rejected';
        notificationMessage = `Your visitor appointment with ${visitor.visitorName || visitor.fullName} has been rejected.`;
        sendToVisitorEmail = true;
        break;

      case EVENTS.APPOINTMENT_RESCHEDULED:
        emailSubject = 'Your Visitor Appointment Has Been Rescheduled';
        emailHtml = generateEmailHeader(emailSubject) + `<p>Your appointment has been rescheduled.</p>`;
        
        if (historyEntry) {
          if (historyEntry.previousAppointmentDate && historyEntry.previousAppointmentDate !== visitor.visitDate) {
            emailHtml += `<p>Previous Date:<br/><b>${historyEntry.previousAppointmentDate}</b></p>`;
          }
          if (historyEntry.previousAppointmentStartTime && historyEntry.previousAppointmentStartTime !== visitor.expectedArrivalTime) {
            emailHtml += `<p>Previous Time:<br/><b>${historyEntry.previousAppointmentStartTime}</b></p>`;
          }
          emailHtml += `<p>New Date:<br/><b>${visitor.visitDate}</b></p>`;
          emailHtml += `<p>New Time:<br/><b>${visitor.expectedArrivalTime} ${visitor.appointmentEndTime ? '- ' + visitor.appointmentEndTime : ''}</b></p>`;
          emailHtml += `<p>Changed By:<br/><b>${changedBy?.name || 'System'} (${changedBy?.role || ''})</b></p>`;
        } else {
          emailHtml += `<p>New Date: <b>${visitor.visitDate}</b></p>`;
          emailHtml += `<p>New Time: <b>${visitor.expectedArrivalTime}</b></p>`;
        }
        
        if (reason) emailHtml += `<p>Reason: <b>${reason}</b></p>`;
        
        emailHtml += actionLink + generateEmailFooter();
        notificationTitle = 'Appointment Rescheduled';
        notificationMessage = `Your appointment with ${visitor.visitorName || visitor.fullName} has been rescheduled to ${visitor.visitDate}.`;
        sendToVisitorEmail = true;
        break;

      case EVENTS.VISITOR_CANCELLED:
        emailSubject = 'Appointment Cancelled';
        emailHtml = generateEmailHeader(emailSubject) + `<p>Your appointment has been cancelled.</p>` + generateEmailFooter();
        notificationTitle = 'Appointment Cancelled';
        notificationMessage = `Your appointment with ${visitor.visitorName || visitor.fullName} has been cancelled.`;
        sendToVisitorEmail = true;
        break;
        
      case EVENTS.VISITOR_CHECKED_IN:
        notificationTitle = 'Visitor Checked In';
        notificationMessage = `${visitor.visitorName || visitor.fullName} has checked in.`;
        sendToVisitorEmail = false; // No email on check-in typically
        break;

      case EVENTS.VISITOR_CHECKED_OUT:
        notificationTitle = 'Visitor Checked Out';
        notificationMessage = `${visitor.visitorName || visitor.fullName} has checked out.`;
        sendToVisitorEmail = false;
        break;

      default:
        return;
    }

    // --- 1. Find Host User ---
    let hostUserId = null;
    if (visitor.hostId) {
      hostUserId = visitor.hostId;
    } else if (visitor.hostName) {
      const hostUser = await User.findOne({ name: visitor.hostName, companyId: visitor.companyId });
      if (hostUser) hostUserId = hostUser._id;
    }

    // --- 2. Create In-App Notification (Database) ---
    // Only dispatch to relevant users, typically the host. Avoid spamming all users.
    if (hostUserId) {
      const notificationDoc = await Notification.create({
        companyId: visitor.companyId,
        branchId: visitor.branch,
        recipient: hostUserId,
        type: 'Visitor',
        module: 'PreBooking',
        title: notificationTitle,
        message: notificationMessage,
        isRead: false
      });

      // Emit real-time update if we have IO attached
      if (io) {
        io.to(hostUserId.toString()).emit('new-notification', notificationDoc);
      }
    }
    
    // Also emit a general visitor status update for the tracking page
    if (io) {
      const vid = visitor._id || visitor.id || visitor.visitorId;
      if (vid) {
        io.emit('visitor:status-updated', { visitorId: vid.toString(), event });
      }
    }

    // --- 3. Attempt Email Delivery ---
    if (sendToVisitorEmail && visitor.email) {
      if (emailService.sendEmail) {
        // We don't await this so it doesn't block the request if the SMTP server is slow
        emailService.sendEmail(visitor.email, emailSubject, emailHtml).catch(err => {
          console.error('Failed to send visitor email asynchronously:', err);
        });
      }
    }

  } catch (error) {
    // We swallow the error so it doesn't break the transaction for the controller.
    console.error('VisitorNotificationService Error:', error);
  }
};

module.exports = {
  EVENTS,
  notifyVisitorStatusChange
};
