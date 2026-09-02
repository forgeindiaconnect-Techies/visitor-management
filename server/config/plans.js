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

    visitorPasses: 500,
    visitors: 500,

    users: 10,
    securityUsers: 5,
    admins: 2,
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

    visitorPasses: 3000,
    visitors: 3000,

    users: 50,
    securityUsers: 25,
    admins: 10,
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
