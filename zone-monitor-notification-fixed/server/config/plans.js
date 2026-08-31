const planLimits = {
  'One Day Trial': {
    visitors: 10,
    securityUsers: 1,
    branches: 1,
    reports: false,
    price: 0
  },
  'Basic': {
    visitors: 500,
    securityUsers: 5,
    admins: 2,
    branches: 1,
    reports: true,
    price: 1999
  },
  'Professional': {
    visitors: -1, // -1 indicates unlimited
    securityUsers: 50,
    admins: 10,
    branches: 10,
    reports: true,
    price: 4999
  },
  'Enterprise': {
    visitors: -1,
    securityUsers: -1,
    admins: -1,
    branches: -1,
    reports: true,
    price: 9999
  }
};

module.exports = planLimits;
