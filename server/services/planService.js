const Plan = require('../models/Plan');

const getPlanByName = async (planName) => {
  if (!planName) {
    throw new Error(
      'Company subscription plan is missing.'
    );
  }

  const plan = await Plan.findOne({
    name: planName,
    isActive: true
  }).lean();

  if (!plan) {
    throw new Error(
      `Subscription plan "${planName}" was not found.`
    );
  }

  return plan;
};

const getCompanyPlan = async (company) => {
  if (!company) {
    throw new Error('Company not found.');
  }

  return getPlanByName(company.subscription);
};

const hasReachedLimit = (
  usedValue,
  limitValue
) => {
  // -1 represents unlimited
  if (Number(limitValue) === -1) {
    return false;
  }

  return Number(usedValue) >= Number(limitValue);
};

const formatPlanLimit = (value) => {
  return Number(value) === -1
    ? 'Unlimited'
    : Number(value).toLocaleString('en-IN');
};

module.exports = {
  getPlanByName,
  getCompanyPlan,
  hasReachedLimit,
  formatPlanLimit
};
