const planLimits = require('../config/plans');

/**
 * Calculate the start and end dates of a subscription cycle.
 *
 * One Day Trial: exactly 24 hours.
 * Paid plans: configured subscription duration, currently 30 days.
 */
const calculateSubscriptionCycle = (
  planName,
  activationDate = new Date()
) => {
  const plan = planLimits[planName];

  if (!plan) {
    const error = new Error(
      `Invalid subscription plan: ${planName}`
    );
    error.statusCode = 400;
    throw error;
  }

  if (
    !plan.durationDays ||
    plan.durationDays <= 0
  ) {
    const error = new Error(
      `Subscription duration is not configured for ${planName}.`
    );
    error.statusCode = 500;
    throw error;
  }

  const cycleStart = new Date(activationDate);

  if (Number.isNaN(cycleStart.getTime())) {
    const error = new Error(
      'Invalid subscription activation date.'
    );
    error.statusCode = 400;
    throw error;
  }

  const cycleEnd = new Date(
    cycleStart.getTime() +
      plan.durationDays *
        24 *
        60 *
        60 *
        1000
  );

  return {
    plan: planName,
    subscriptionStartedAt: cycleStart,
    subscriptionExpiresAt: cycleEnd,
    durationDays: plan.durationDays
  };
};

/**
 * Start a fresh subscription cycle after a renewal or plan change.
 *
 * A new cycle automatically receives a separate usage record when
 * visitor-pass usage is requested for the first time.
 */
const startNewSubscriptionCycle = async ({
  company,
  newPlan,
  updatedBy,
  activationDate = new Date()
}) => {
  if (!company) {
    const error = new Error('Company is required.');
    error.statusCode = 400;
    throw error;
  }

  const cycle = calculateSubscriptionCycle(
    newPlan,
    activationDate
  );

  company.subscription = newPlan;

  company.subscriptionStartedAt =
    cycle.subscriptionStartedAt;

  company.subscriptionExpiresAt =
    cycle.subscriptionExpiresAt;

  company.status = 'Active';

  if (!Array.isArray(company.upgradeHistory)) {
    company.upgradeHistory = [];
  }

  company.upgradeHistory.push({
    plan: newPlan,
    startDate: cycle.subscriptionStartedAt,
    endDate: cycle.subscriptionExpiresAt,
    updatedBy:
      updatedBy || 'SaaS Super Admin',
    date: new Date()
  });

  await company.save();

  return {
    company,
    plan: newPlan,
    subscriptionStartedAt:
      cycle.subscriptionStartedAt,
    subscriptionExpiresAt:
      cycle.subscriptionExpiresAt
  };
};

module.exports = {
  calculateSubscriptionCycle,
  startNewSubscriptionCycle
};
