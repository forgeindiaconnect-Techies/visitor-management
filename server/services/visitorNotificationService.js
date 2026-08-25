const Notification = require('../models/Notification');
const User = require('../models/User');
const ApprovalPermission = require('../models/ApprovalPermission');
const emailService = require('../utils/emailService');
const { formatDisplayName } = require('../utils/nameFormatter');

const VISITOR_EVENTS = {
  REGISTERED: 'VISITOR_REGISTERED',
  APPROVED: 'VISITOR_APPROVED',
  REJECTED: 'VISITOR_REJECTED',
  RESCHEDULED: 'APPOINTMENT_RESCHEDULED',
  CHECKED_IN: 'VISITOR_CHECKED_IN',
  CHECKED_OUT: 'VISITOR_CHECKED_OUT',
  QR_AVAILABLE: 'QR_PASS_AVAILABLE'
};

const mapPermissionRoleToUserRole = (permRole) => {
  switch(permRole) {
    case 'SUPER_ADMIN': return 'Super Admin';
    case 'MD': return 'MD';
    case 'SENIOR_HR': return 'HR';
    case 'IT': return 'IT';
    default: return permRole;
  }
};

const notifyVisitorEvent = async ({
  visitor,
  event,
  actor = null,
  reason = null,
  io = null
}) => {
  try {
    let emailSubject = '';
    let emailHtml = '';
    let notificationTitle = '';
    let notificationMessage = '';
    let sendEmailToVisitor = false;
    let notifyRecipients = []; // Array of User IDs to receive the in-app notification

    // Helper to get all dashboard user IDs for broadcasting (optimized single DB query)
    const getDashboardUserIds = async () => {
      const allPermissions = await ApprovalPermission.find({});
      const disabledRoles = new Set(
        allPermissions
          .filter(p => p.canApprove === false)
          .map(p => mapPermissionRoleToUserRole(p.role))
      );
      
      const defaultRoles = ['Super Admin', 'SaaS Super Admin', 'MD', 'HR', 'Admin', 'Branch Admin', 'Senior HR', 'Receptionist', 'Security'];
      const eligibleRoles = defaultRoles.filter(role => !disabledRoles.has(role));

      const companyRegex = new RegExp(`^${visitor.companyId || 'FIC001'}$`, 'i');
      const users = await User.find({
        role: { $in: eligibleRoles },
        $or: [{ companyId: companyRegex }, { companyId: 'SYSTEM' }, { companyId: null }]
      }).select('_id');
      
      return users.map(u => u._id.toString());
    };

    const rawFrontendUrl = process.env.FRONTEND_URL || 'https://zone-monitor.vercel.app';
    const frontendUrl = String(rawFrontendUrl).replace(/[\r\n\t]/g, '').trim().replace(/\/+$/, '');
    const passId = visitor.visitorId || visitor.visitId || visitor._id;
    const trackingUrl = `${frontendUrl}/pass/${passId}`;
    const actionLink = `<p><br/><a href="${trackingUrl}" style="padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">VIEW VISITOR PASS</a></p>`;

    // --- Format Dates for Email ---
    const visitDateFormatted = visitor.visitDate ? new Date(visitor.visitDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'TBD';
    const timeFormatted = `${visitor.expectedArrivalTime || visitor.expectedTime || 'TBD'} ${(visitor.appointmentEndTime) ? '- ' + visitor.appointmentEndTime : ''}`;

    // --- Find Host User ---
    let hostUserId = visitor.hostId || null;
    if (!hostUserId && visitor.hostName) {
      const hostUser = await User.findOne({ name: visitor.hostName, companyId: visitor.companyId });
      if (hostUser) hostUserId = hostUser._id.toString();
    }

    // Detect returning visitor status strictly when explicitly flagged
    const isReturningVisitor = Boolean(
      visitor.isReturning || 
      visitor.returningVisitor || 
      visitor.registrationType === 'Returning'
    );

    switch (event) {
      case VISITOR_EVENTS.REGISTERED:
        emailSubject = isReturningVisitor 
          ? 'Welcome Back — New Visit Request Submitted' 
          : 'Pre-Booking Submitted — Track Your Visit';
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="background-color: #0f172a; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="margin: 0; font-size: 20px;">${isReturningVisitor ? 'Welcome Back — Visit Request Submitted' : 'Pre-Booking Submitted'}</h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff;">
              <p style="font-size: 16px; color: #1e293b;">Hello <strong>${visitor.visitorName || visitor.fullName}</strong>,</p>
              <p style="font-size: 14px; color: #475569;">${isReturningVisitor ? 'Welcome back! Your new appointment request has been submitted.' : 'Your appointment request has been submitted.'}</p>
              <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 4px 0; font-size: 14px;"><strong>Status:</strong> <span style="color: #d97706; font-weight: bold;">Pending Approval</span></p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Appointment:</strong><br/>${visitDateFormatted}<br/>${timeFormatted}</p>
              </div>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${trackingUrl}" target="_blank" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 14px;">VIEW VISITOR PASS</a>
              </div>
            </div>
          </div>
        `;

        notificationTitle = isReturningVisitor ? 'A Returning Visitor Request Received' : 'A New Visitor Request Received';
        notificationMessage = `${isReturningVisitor ? 'Returning' : 'New'} visitor ${visitorDisplayName} waiting for approval`;
        sendEmailToVisitor = true;

        notifyRecipients = await getDashboardUserIds();
        if (hostUserId && !notifyRecipients.includes(hostUserId)) notifyRecipients.push(hostUserId);

        break;

      case VISITOR_EVENTS.APPROVED:
        emailSubject = isReturningVisitor 
          ? 'Welcome Back — Visit Appointment Approved' 
          : 'Visitor Appointment Approved';
        const approvedByName = formatDisplayName(actor?.name || 'Authorized Personnel');
        const approvedByRole = actor?.role || 'Admin';
        const approvedVisitorName = formatDisplayName(visitor.visitorName || visitor.fullName || 'Visitor');
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="background-color: #16a34a; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="margin: 0; font-size: 20px;">&#10004; ${isReturningVisitor ? 'Welcome Back — Appointment Approved' : 'Appointment Approved'}</h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff;">
              <p style="font-size: 16px; color: #1e293b;">Hello <strong>${approvedVisitorName}</strong>,</p>
              <div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 4px 0; font-size: 14px;"><strong>Approved By:</strong> ${approvedByName}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Role:</strong> ${approvedByRole}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Appointment:</strong><br/>${visitDateFormatted}<br/>${timeFormatted}</p>
              </div>
              <p style="font-size: 14px; color: #475569;">${isReturningVisitor ? 'Welcome back! Your visitor pass is approved and ready.' : 'Your visitor pass is ready.'}</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${trackingUrl}" target="_blank" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">VIEW VISITOR PASS</a>
              </div>
            </div>
          </div>
        `;
        notificationTitle = isReturningVisitor ? 'Returning Pre-Booking Approved' : 'Pre-Booking Approved';
        notificationMessage = `${isReturningVisitor ? 'Returning visitor' : 'Visitor'} pre-booking for ${approvedVisitorName} has been approved by ${approvedByName}.`;
        sendEmailToVisitor = true;

        notifyRecipients = await getDashboardUserIds();
        if (hostUserId && !notifyRecipients.includes(hostUserId)) notifyRecipients.push(hostUserId);
        break;

      case VISITOR_EVENTS.REJECTED:
        emailSubject = 'Appointment Rejected';
        const rejectedVisitorName = formatDisplayName(visitor.visitorName || visitor.fullName || 'Visitor');
        const rejectedByName = formatDisplayName(actor?.name || 'Authorized Personnel');
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="background-color: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="margin: 0; font-size: 20px;">Appointment Rejected</h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff;">
              <p style="font-size: 16px; color: #1e293b;">Hello <strong>${rejectedVisitorName}</strong>,</p>
              <p style="font-size: 14px; color: #475569;">Your appointment request was rejected.</p>
              <div style="background-color: #fef2f2; border: 1px solid #fca5a5; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 4px 0; font-size: 14px;"><strong>Reason:</strong> ${reason || 'Host unavailable on the selected date.'}</p>
              </div>
              <p style="font-size: 14px; color: #475569;">Please contact the organization for further assistance.</p>
            </div>
          </div>
        `;
        notificationTitle = isReturningVisitor ? 'Returning Pre-Booking Rejected' : 'Pre-Booking Rejected';
        notificationMessage = `${isReturningVisitor ? 'Returning visitor' : 'Visitor'} pre-booking for ${rejectedVisitorName} has been rejected by ${rejectedByName}.`;
        sendEmailToVisitor = true;

        notifyRecipients = await getDashboardUserIds();
        if (hostUserId && !notifyRecipients.includes(hostUserId)) notifyRecipients.push(hostUserId);
        break;

      case VISITOR_EVENTS.RESCHEDULED:
        emailSubject = 'Appointment Rescheduled';
        const latestReschedule =
          visitor.rescheduleHistory && visitor.rescheduleHistory.length > 0
            ? visitor.rescheduleHistory[visitor.rescheduleHistory.length - 1]
            : null;

        const reschedulerName = formatDisplayName(
          actor?.name ||
          actor?.userName ||
          latestReschedule?.rescheduledBy?.name ||
          'Authorized Personnel'
        );

        const visitorDisplayName = formatDisplayName(
          visitor.visitorName || visitor.fullName || 'Visitor'
        );

        const oldDateFormatted =
          latestReschedule?.oldVisitDate
            ? new Date(latestReschedule.oldVisitDate).toLocaleDateString(
                'en-GB',
                {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                }
              )
            : 'Previous Date';

        const oldTimeFormatted =
          latestReschedule?.oldExpectedTime || 'Previous Time';
        
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="background-color: #2563eb; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0; text-align: center;">
              <h2 style="margin: 0; font-size: 20px;">Appointment Rescheduled</h2>
            </div>
            <div style="padding: 24px; background-color: #ffffff;">
              <p style="font-size: 16px; color: #1e293b;">Hello <strong>${visitorDisplayName}</strong>,</p>
              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 4px 0; font-size: 14px;"><strong>Rescheduled By:</strong> ${reschedulerName}</p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Previous:</strong><br/>${oldDateFormatted}<br/>${oldTimeFormatted}</p>
                <hr style="border: 1px solid #bfdbfe; margin: 12px 0;" />
                <p style="margin: 4px 0; font-size: 14px;"><strong>New:</strong><br/>${visitDateFormatted}<br/>${timeFormatted}</p>
                <hr style="border: 1px solid #bfdbfe; margin: 12px 0;" />
                <p style="margin: 4px 0; font-size: 14px;"><strong>Reason:</strong><br/>${reason || 'Host requested a different appointment time.'}</p>
              </div>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${trackingUrl}" target="_blank" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">VIEW UPDATED APPOINTMENT</a>
              </div>
            </div>
          </div>
        `;
        notificationTitle = isReturningVisitor ? 'Returning Appointment Rescheduled' : 'Appointment Rescheduled';
        notificationMessage = `${reschedulerName} has rescheduled the appointment for ${isReturningVisitor ? 'returning visitor' : 'visitor'} ${visitorDisplayName} to ${visitDateFormatted}, ${timeFormatted}.`;
        sendEmailToVisitor = true;

        notifyRecipients = await getDashboardUserIds();
        if (hostUserId && !notifyRecipients.includes(hostUserId)) notifyRecipients.push(hostUserId);
        break;

      case VISITOR_EVENTS.QR_AVAILABLE:
        notificationTitle = isReturningVisitor ? 'Returning Visitor Pass Available' : 'Visitor Pass Available';
        notificationMessage = `Status: APPROVED. ${visitor.visitorName || visitor.fullName} can now be verified at reception.`;
        
        notifyRecipients = await getDashboardUserIds();
        sendEmailToVisitor = false;
        break;

      case VISITOR_EVENTS.CHECKED_IN:
        notificationTitle = 'Visitor Checked In';
        notificationMessage = `Visitor ${visitorDisplayName} has arrived and checked in.`;
        sendEmailToVisitor = false;
        
        notifyRecipients = await getDashboardUserIds();
        if (hostUserId && !notifyRecipients.includes(hostUserId)) notifyRecipients.push(hostUserId);
        break;

      case VISITOR_EVENTS.CHECKED_OUT:
        notificationTitle = 'Visitor Checked Out';
        notificationMessage = `Visitor ${visitorDisplayName} has checked out.`;
        sendEmailToVisitor = false;
        
        notifyRecipients = await getDashboardUserIds();
        if (hostUserId && !notifyRecipients.includes(hostUserId)) notifyRecipients.push(hostUserId);
        break;

      default:
        return;
    }

    // --- Create DB Notification ---
    const formattedRecipients = (notifyRecipients || []).map((id) => ({
      userId: String(id),
      user: id
    }));

    const notificationEventId =
      event === VISITOR_EVENTS.RESCHEDULED
        ? `PREBOOK_RESCHEDULED_${visitor._id}_${new Date(visitor.visitDate).getTime()}_${visitor.expectedArrivalTime || visitor.expectedTime}`
        : `${event}_${visitor._id}`;

    const notificationDoc = await Notification.findOneAndUpdate(
      { eventId: notificationEventId },
      {
        $set: {
          title: notificationTitle,
          message: notificationMessage,
          isReturning: isReturningVisitor,
          visitorType: isReturningVisitor ? 'RETURNING_PRE_BOOKING' : 'PRE_BOOKING'
        },
        $setOnInsert: {
          eventId: notificationEventId,
          companyId: visitor.companyId || 'FIC001',
          branchId: visitor.branch || visitor.branchLocation,
          recipients: formattedRecipients,
          roles: ['Super Admin', 'SaaS Super Admin', 'Admin', 'Branch Admin', 'MD', 'Senior HR', 'HR', 'Security', 'Receptionist'],
          visitorId: visitor.visitorId || null,
          visitorName: visitorDisplayName,
          preBookingId: visitor._id,
          createdBy: reschedulerName || 'Authorized Personnel',
          type: 'Visitor',
          module: 'PreBooking',
          isRead: false
        }
      },
      {
        new: true,
        upsert: true
      }
    );

    // --- Emit Socket.IO Event for App Notification ---
    if (io && notificationDoc) {
      // Broadcast to everyone; client filters via `recipients` array
      io.emit('new_notification', notificationDoc);
    }
    
    // --- Emit Socket.IO Event for Tracking Page / Real-Time UI ---
    if (io) {
      const vid = visitor._id || visitor.id || visitor.visitorId;
      if (vid) {
        io.emit('visitor:status-updated', { 
          visitorId: vid.toString(), 
          status: visitor.approvalStatus || visitor.status 
        });
      }
    }

    // --- Attempt Email Delivery ---
    if (sendEmailToVisitor && (visitor.email || visitor.visitorEmail)) {
      const recipientEmail = visitor.email || visitor.visitorEmail;
      // Do NOT await, execute asynchronously to prevent blocking approval
      emailService.sendEmail(recipientEmail, emailSubject, emailHtml).catch(err => {
        console.error('Email failed | Visitor ID:', visitor._id, '| Event:', event, '| Error:', err.message, '| Timestamp:', new Date().toISOString());
      });
    }

  } catch (error) {
    // Log unexpected errors, do NOT rollback DB changes
    console.error('Failed in notifyVisitorEvent | Event:', event, '| Error:', error.message);
  }
};

module.exports = {
  VISITOR_EVENTS,
  notifyVisitorEvent
};
