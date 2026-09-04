const express = require('express');
const router = express.Router();

const Plan = require('../models/Plan');
const authMiddleware = require('../middleware/authMiddleware');

// Public API: Used by landing page and Upgrade Plan page
router.get('/', async (req, res) => {
  try {
    let plans = await Plan.find({
      isActive: true
    }).sort({
      price: 1
    });

    if (plans.length === 0) {
      const defaultPlans = [
        {
          name: 'One Day Trial',
          price: 0,
          durationDays: 1,
          visitorPasses: 25,
          branches: 1,
          users: 3,
          securityUsers: 1,
          admins: 1,
          reports: false,
          description: 'Try the essential visitor management features for 24 hours.',
          features: { qrPass: true, preBooking: true, emailNotifications: true, advancedReports: false, customBranding: false, apiAccess: false, prioritySupport: false },
          isActive: true
        },
        {
          name: 'Basic',
          price: 1999,
          durationDays: 30,
          visitorPasses: 500,
          branches: 1,
          users: 10,
          securityUsers: 5,
          admins: 2,
          reports: true,
          description: 'Suitable for small companies with one branch.',
          features: { qrPass: true, preBooking: true, emailNotifications: true, advancedReports: false, customBranding: false, apiAccess: false, prioritySupport: false },
          isActive: true
        },
        {
          name: 'Standard',
          price: 4999,
          durationDays: 30,
          visitorPasses: 3000,
          branches: 5,
          users: 50,
          securityUsers: 25,
          admins: 10,
          reports: true,
          description: 'Advanced reporting and branding for growing companies.',
          features: { qrPass: true, preBooking: true, emailNotifications: true, advancedReports: true, customBranding: true, apiAccess: false, prioritySupport: false },
          isActive: true
        },
        {
          name: 'Enterprise',
          price: 9999,
          durationDays: 30,
          visitorPasses: -1,
          branches: -1,
          users: -1,
          securityUsers: -1,
          admins: -1,
          reports: true,
          description: 'Unlimited usage with API access and priority support.',
          features: { qrPass: true, preBooking: true, emailNotifications: true, advancedReports: true, customBranding: true, apiAccess: true, prioritySupport: true },
          isActive: true
        }
      ];

      for (const plan of defaultPlans) {
        await Plan.updateOne(
          { name: plan.name },
          { $setOnInsert: { ...plan, updatedBy: 'Initial Setup' } },
          { upsert: true }
        );
      }

      plans = await Plan.find({ isActive: true }).sort({ price: 1 });
    }

    return res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Get plans error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load subscription plans.'
    });
  }
});

// SaaS Super Admin: Get all active and inactive plans
router.get(
  '/admin',
  authMiddleware,
  async (req, res) => {
    try {
      if (!['SaaS Super Admin', 'Super Admin'].includes(req.userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied.'
        });
      }

      let plans = await Plan.find().sort({
        price: 1
      });

      if (plans.length === 0) {
        const defaultPlans = [
          {
            name: 'One Day Trial',
            price: 0,
            durationDays: 1,
            visitorPasses: 25,
            branches: 1,
            users: 3,
            securityUsers: 1,
            admins: 1,
            reports: false,
            description: 'Try the essential visitor management features for 24 hours.',
            features: { qrPass: true, preBooking: true, emailNotifications: true, advancedReports: false, customBranding: false, apiAccess: false, prioritySupport: false },
            isActive: true
          },
          {
            name: 'Basic',
            price: 1999,
            durationDays: 30,
            visitorPasses: 500,
            branches: 1,
            users: 10,
            securityUsers: 5,
            admins: 2,
            reports: true,
            description: 'Suitable for small companies with one branch.',
            features: { qrPass: true, preBooking: true, emailNotifications: true, advancedReports: false, customBranding: false, apiAccess: false, prioritySupport: false },
            isActive: true
          },
          {
            name: 'Standard',
            price: 4999,
            durationDays: 30,
            visitorPasses: 3000,
            branches: 5,
            users: 50,
            securityUsers: 25,
            admins: 10,
            reports: true,
            description: 'Advanced reporting and branding for growing companies.',
            features: { qrPass: true, preBooking: true, emailNotifications: true, advancedReports: true, customBranding: true, apiAccess: false, prioritySupport: false },
            isActive: true
          },
          {
            name: 'Enterprise',
            price: 9999,
            durationDays: 30,
            visitorPasses: -1,
            branches: -1,
            users: -1,
            securityUsers: -1,
            admins: -1,
            reports: true,
            description: 'Unlimited usage with API access and priority support.',
            features: { qrPass: true, preBooking: true, emailNotifications: true, advancedReports: true, customBranding: true, apiAccess: true, prioritySupport: true },
            isActive: true
          }
        ];

        for (const plan of defaultPlans) {
          await Plan.updateOne(
            { name: plan.name },
            { $setOnInsert: { ...plan, updatedBy: 'Initial Setup' } },
            { upsert: true }
          );
        }

        plans = await Plan.find().sort({ price: 1 });
      }

      return res.json({
        success: true,
        data: plans
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to load plans.'
      });
    }
  }
);

// SaaS Super Admin: Update one plan
router.put(
  '/:planId',
  authMiddleware,
  async (req, res) => {
    try {
      if (!['SaaS Super Admin', 'Super Admin'].includes(req.userRole)) {
        return res.status(403).json({
          success: false,
          message:
            'Only Super Admin or SaaS Super Admin can update plans.'
        });
      }

      const allowedFields = [
        'price',
        'durationDays',
        'visitorPasses',
        'branches',
        'users',
        'securityUsers',
        'admins',
        'reports',
        'description',
        'features',
        'isActive'
      ];

      const updates = {};

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      const limitFields = [
        'visitorPasses',
        'branches',
        'users',
        'securityUsers',
        'admins'
      ];

      for (const field of limitFields) {
        if (
          updates[field] !== undefined &&
          (
            !Number.isInteger(Number(updates[field])) ||
            Number(updates[field]) < -1
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              `${field} must be zero, a positive number, or -1 for unlimited.`
          });
        }

        if (updates[field] !== undefined) {
          updates[field] = Number(updates[field]);
        }
      }

      if (
        updates.price !== undefined &&
        Number(updates.price) < 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'Price cannot be negative.'
        });
      }

      if (updates.price !== undefined) {
        updates.price = Number(updates.price);
      }

      if (
        updates.durationDays !== undefined &&
        Number(updates.durationDays) < 1
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Plan duration must be at least one day.'
        });
      }

      if (updates.durationDays !== undefined) {
        updates.durationDays =
          Number(updates.durationDays);
      }

      updates.updatedBy =
        req.userName ||
        'SaaS Super Admin';

      const updatedPlan =
        await Plan.findByIdAndUpdate(
          req.params.planId,
          { $set: updates },
          {
            new: true,
            runValidators: true
          }
        );

      if (!updatedPlan) {
        return res.status(404).json({
          success: false,
          message: 'Plan not found.'
        });
      }

      const io = req.app.get('io');

      if (io) {
        io.emit('subscription_plan_updated', {
          plan: updatedPlan
        });
      }

      return res.json({
        success: true,
        message:
          `${updatedPlan.name} plan updated successfully.`,
        data: updatedPlan
      });
    } catch (error) {
      console.error('Update plan error:', error);

      return res.status(500).json({
        success: false,
        message:
          error.message || 'Failed to update plan.'
      });
    }
  }
);

module.exports = router;
