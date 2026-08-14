const Notification = require('../models/Notification');
const User = require('../models/User');
// Note: emailService doesn't export functions individually if it's not structured that way.
// Wait, I saw sendPreBookingInvitation in emailService.js, let me require the whole module.
const emailService = require('./emailService'); 

// A wrapper to handle DB updates, Emails, and In-App Notifications for Pre-Bookings
const sendStatusUpdates = async (visitor, status, actorRole, historyEntry = null) => {
  try {
    const statusTitles = {
      'PENDING': 'Pre-Booking Request Submitted',
      'APPROVED': 'Visitor Appointment Approved',
      'REJECTED': 'Visitor Appointment Rejected',
      'DATE_CHANGED': 'Your Visitor Appointment Has Been Rescheduled',
      'TIME_CHANGED': 'Your Visitor Appointment Has Been Rescheduled',
      'CANCELLED': 'Appointment Cancelled'
    };

    let emailSubject = statusTitles[status] || 'Visitor Status Update';
    let emailHtml = `<div style="font-family: Arial, sans-serif; padding: 20px;">`;
    emailHtml += `<h2>${emailSubject}</h2>`;
    emailHtml += `<p>Visitor: <b>${visitor.visitorName || visitor.fullName || 'N/A'}</b></p>`;
    emailHtml += `<p>Host: <b>${visitor.hostName || visitor.hostEmployee || 'N/A'}</b></p>`;
    
    if (status === 'APPROVED') {
      emailHtml += `<p>Your appointment on <b>${visitor.visitDate}</b> at <b>${visitor.expectedArrivalTime}</b> has been approved.</p>`;
      emailHtml += `<p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/visitor-status/${visitor._id}" style="padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">View Status & QR Pass</a></p>`;
    } else if (status === 'REJECTED') {
      emailHtml += `<p>Your appointment request has been rejected.</p>`;
      if (visitor.rejectionReason) {
        emailHtml += `<p>Reason: ${visitor.rejectionReason}</p>`;
      }
    } else if (status === 'DATE_CHANGED' || status === 'TIME_CHANGED') {
      emailHtml += `<p>Your appointment has been rescheduled.</p>`;
      if (historyEntry) {
        if (historyEntry.previousAppointmentDate && historyEntry.previousAppointmentDate !== visitor.visitDate) {
          emailHtml += `<p>Previous Date:<br/><b>${historyEntry.previousAppointmentDate}</b></p>`;
        }
        if (historyEntry.previousAppointmentStartTime && historyEntry.previousAppointmentStartTime !== visitor.expectedArrivalTime) {
          emailHtml += `<p>Previous Time:<br/><b>${historyEntry.previousAppointmentStartTime}</b></p>`;
        }
        
        emailHtml += `<p>New Date:<br/><b>${visitor.visitDate}</b></p>`;
        emailHtml += `<p>New Time:<br/><b>${visitor.expectedArrivalTime} ${visitor.appointmentEndTime ? '- ' + visitor.appointmentEndTime : ''}</b></p>`;
        emailHtml += `<p>Changed By:<br/><b>${actorRole || 'System'}</b></p>`;
      } else {
        emailHtml += `<p>New Date: <b>${visitor.visitDate}</b></p>`;
        emailHtml += `<p>New Time: <b>${visitor.expectedArrivalTime}</b></p>`;
      }
      emailHtml += `<br/><p><a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/visitor-status/${visitor._id}" style="padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px;">View Updated Status</a></p>`;
    }

    emailHtml += `</div>`;

    // 1. Send Email to Visitor if email exists
    if (visitor.email) {
      if (emailService.sendEmail) {
        await emailService.sendEmail(visitor.email, emailSubject, emailHtml);
      } else {
        console.warn('sendEmail function not found on emailService module.');
      }
    }

    // 2. Create In-App Notification for Host
    // Find the host user by email or name if hostId isn't reliable
    let hostUser;
    if (visitor.hostId) {
      hostUser = await User.findById(visitor.hostId);
    } else {
      // Fallback: Try to find by name and company
      hostUser = await User.findOne({ name: visitor.hostName, companyId: visitor.companyId });
    }

    const notificationMessage = status === 'APPROVED' ? `Your visitor appointment with ${visitor.visitorName} has been approved.` :
                               status === 'REJECTED' ? `Your visitor appointment with ${visitor.visitorName} has been rejected.` :
                               status === 'DATE_CHANGED' ? `Your appointment with ${visitor.visitorName} has been rescheduled to ${visitor.visitDate}.` :
                               status === 'TIME_CHANGED' ? `Your appointment time with ${visitor.visitorName} has been changed to ${visitor.expectedArrivalTime}.` :
                               `Visitor ${visitor.visitorName} status updated to ${status}.`;

    // Note: To avoid spamming all users in the branch (because of Notification.js post-save hook), 
    // we should ideally patch Notification.js to respect recipient, but for now we create it.
    await Notification.create({
      companyId: visitor.companyId,
      branchId: visitor.branch,
      recipient: hostUser ? hostUser._id : null,
      type: 'Visitor',
      module: 'PreBooking',
      title: statusTitles[status] || 'Visitor Update',
      message: notificationMessage,
      isRead: false
    });

  } catch (error) {
    console.error('Error sending status updates:', error);
  }
};

module.exports = {
  sendStatusUpdates
};
