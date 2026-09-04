const planLimits = {
  'One Day Trial': {
    durationDays: 1,

    visitorPasses: 25,
    visitors: 25, // Compatibility with existing code

    users: 3,
    securityUsers: 1,
    admins: 1,
    branches: 1,

    reports: false,
    price: 0,

    features: {
      qrPass: true,
      preBooking: true,
      emailNotifications: true,
      advancedReports: false,
      customBranding: false,
      apiAccess: false
    }
  },

  Basic: {
    durationDays: 30,

    visitorPasses: 150,
    visitors: 150,

    users: 5,
    securityUsers: 2,
    admins: 1,
    branches: 1,

    reports: true,
    price: 1999,

    features: {
      qrPass: true,
      preBooking: true,
      emailNotifications: true,
      advancedReports: false,
      customBranding: false,
      apiAccess: false
    }
  },

  Standard: {
    durationDays: 30,

    visitorPasses: 1000,
    visitors: 1000,

    users: 15,
    securityUsers: 8,
    admins: 3,
    branches: 5,

    reports: true,
    price: 4999,

    features: {
      qrPass: true,
      preBooking: true,
      emailNotifications: true,
      advancedReports: true,
      customBranding: true,
      apiAccess: false
    }
  },

  Enterprise: {
    durationDays: 30,

    visitorPasses: -1,
    visitors: -1,

    users: -1,
    securityUsers: -1,
    admins: -1,
    branches: -1,

    reports: true,
    price: 9999,

    features: {
      qrPass: true,
      preBooking: true,
      emailNotifications: true,
      advancedReports: true,
      customBranding: true,
      apiAccess: true
    }
  }
};

module.exports = planLimits;
