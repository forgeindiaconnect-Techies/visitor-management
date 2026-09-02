const getTenantFilter = (req) => {
  if (
    req.userRole === 'SaaS Super Admin' &&
    req.companyId === 'SYSTEM'
  ) {
    return {};
  }

  if (!req.companyId) {
    throw new Error('Company information is missing');
  }

  return {
    companyId: String(req.companyId)
      .trim()
      .toUpperCase()
  };
};

module.exports = getTenantFilter;
