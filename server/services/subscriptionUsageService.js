const Company = require('../models/Company');
const SubscriptionUsage = require('../models/SubscriptionUsage');
const planLimits = require('../config/plans');

const LIMIT_REACHED_MESSAGE =
  'Your monthly visitor-pass limit has been reached. Please upgrade your subscription.';

/**
 * Find the start date of the company's current subscription cycle.
 */
const getCycleStart = (company) => {
  if (company.subscriptionStartedAt) {
    return new Date(company.subscriptionStartedAt);
  }

  const history = Array.isArray(company.upgradeHistory)
    ? company.upgradeHistory
    : [];

  const latestHistory = [...history]
    .filter((item) => item.startDate)
    .sort(
      (a, b) =>
        new Date(b.startDate).getTime() -
        new Date(a.startDate).getTime()
    )[0];

  if (latestHistory?.startDate) {
    return new Date(latestHistory.startDate);
  }

  return new Date(company.createdAt);
};

/**
 * Find the end date of the company's current subscription cycle.
 */
const getCycleEnd = (company) => {
  return new Date(company.subscriptionExpiresAt);
};

/**
 * Find a company using its company code.
 */
const getCompany = async (
  companyId,
  { allowExpired = false } = {}
) => {
  const normalizedCompanyId = String(companyId || '')
    .trim()
    .toUpperCase();

  if (!normalizedCompanyId) {
    const error = new Error('Company ID is required.');
    error.statusCode = 400;
    throw error;
  }

  const company = await Company.findOne({
    code: normalizedCompanyId
  });

  if (!company) {
    const error = new Error('Company not found.');
    error.statusCode = 404;
    throw error;
  }

  const cycleEnd = getCycleEnd(company);

  const subscriptionExpired =
    Number.isNaN(cycleEnd.getTime()) ||
    cycleEnd.getTime() <= Date.now();

  if (!allowExpired) {
    if (company.status !== 'Active') {
      const error = new Error(
        'This company subscription is not active.'
      );
      error.statusCode = 403;
      throw error;
    }

    if (subscriptionExpired) {
      const error = new Error(
        'Your subscription has expired. Please renew your subscription.'
      );
      error.statusCode = 403;
      error.code = 'SUBSCRIPTION_EXPIRED';
      throw error;
    }
  }

  return company;
};

/**
 * Create the usage document for the current subscription cycle if needed.
 */
const getOrCreateUsage = async (company) => {
  const companyId = company.code.toUpperCase();
  const cycleStart = getCycleStart(company);
  const cycleEnd = getCycleEnd(company);

  let usage = await SubscriptionUsage.findOne({
    companyId,
    cycleStart,
    cycleEnd
  });

  if (usage) {
    return usage;
  }

  try {
    usage = await SubscriptionUsage.create({
      companyId,
      plan: company.subscription,
      cycleStart,
      cycleEnd,
      visitorPassesUsed: 0
    });
  } catch (error) {
    // Another request may have created the same cycle record.
    if (error.code === 11000) {
      usage = await SubscriptionUsage.findOne({
        companyId,
        cycleStart,
        cycleEnd
      });
    } else {
      throw error;
    }
  }

  return usage;
};

/**
 * Reserve one visitor pass before generating a new pass.
 *
 * If pass generation later fails, call releaseVisitorPass().
 * This prevents simultaneous requests from exceeding the plan limit.
 */
const reserveVisitorPass = async (companyId) => {
  const company = await getCompany(companyId);
  const plan = planLimits[company.subscription];

  if (!plan) {
    const error = new Error(
      `Plan configuration not found for ${company.subscription}.`
    );
    error.statusCode = 500;
    throw error;
  }

  if (!plan.features?.qrPass) {
    const error = new Error(
      'QR visitor passes are not available in this subscription.'
    );
    error.statusCode = 403;
    throw error;
  }

  const usage = await getOrCreateUsage(company);
  const limit = plan.visitorPasses;

  let updatedUsage;

  if (limit === -1) {
    updatedUsage = await SubscriptionUsage.findByIdAndUpdate(
      usage._id,
      {
        $inc: {
          visitorPassesUsed: 1
        },
        $set: {
          plan: company.subscription,
          lastPassGeneratedAt: new Date()
        }
      },
      {
        new: true
      }
    );
  } else {
    updatedUsage = await SubscriptionUsage.findOneAndUpdate(
      {
        _id: usage._id,
        visitorPassesUsed: {
          $lt: limit
        }
      },
      {
        $inc: {
          visitorPassesUsed: 1
        },
        $set: {
          plan: company.subscription,
          lastPassGeneratedAt: new Date()
        }
      },
      {
        new: true
      }
    );
  }

  if (!updatedUsage) {
    const error = new Error(LIMIT_REACHED_MESSAGE);
    error.statusCode = 403;
    error.code = 'VISITOR_PASS_LIMIT_REACHED';
    error.limit = limit;
    error.used = usage.visitorPassesUsed;
    throw error;
  }

  return {
    company,
    usage: updatedUsage,
    used: updatedUsage.visitorPassesUsed,
    limit,
    cycleStart: updatedUsage.cycleStart,
    cycleEnd: updatedUsage.cycleEnd
  };
};

/**
 * Undo a reservation when new-pass generation fails.
 */
const releaseVisitorPass = async (usageId) => {
  if (!usageId) {
    return;
  }

  await SubscriptionUsage.findOneAndUpdate(
    {
      _id: usageId,
      visitorPassesUsed: {
        $gt: 0
      }
    },
    {
      $inc: {
        visitorPassesUsed: -1
      }
    }
  );
};

/**
 * Return usage details for the company dashboard.
 */
const getVisitorPassUsage = async (companyId) => {
  const company = await getCompany(
    companyId,
    { allowExpired: true }
  );
  const plan = planLimits[company.subscription];

  if (!plan) {
    const error = new Error(
      `Plan configuration not found for ${company.subscription}.`
    );
    error.statusCode = 500;
    throw error;
  }

  const usage = await getOrCreateUsage(company);

  return {
    companyId: company.code,
    plan: company.subscription,
    status: company.status,

    expired:
      new Date(
        company.subscriptionExpiresAt
      ).getTime() <= Date.now(),

    visitorPassesUsed: usage.visitorPassesUsed,
    visitorPassLimit: plan.visitorPasses,
    unlimited: plan.visitorPasses === -1,
    cycleStart: usage.cycleStart,
    renewalDate: usage.cycleEnd
  };
};

module.exports = {
  LIMIT_REACHED_MESSAGE,
  reserveVisitorPass,
  releaseVisitorPass,
  getVisitorPassUsage
};
