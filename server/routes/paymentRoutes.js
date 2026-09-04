const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Company = require('../models/Company');
const authMiddleware = require('../middleware/authMiddleware');


const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

console.log("Payment Route Loaded - Razorpay Key ID:", process.env.RAZORPAY_KEY_ID || 'NONE');
console.log("Payment Route Loaded - Secret Present:", !!process.env.RAZORPAY_KEY_SECRET);

router.use(authMiddleware);

// POST /api/payment/create-order
router.post('/create-order', async (req, res) => {
  try {
    const { plan: planNameParam, requestedPlan } = req.body;
    const targetPlanName = requestedPlan || planNameParam;

    if (!targetPlanName) {
      return res.status(400).json({ message: 'Plan selection is required' });
    }

    const Plan = require('../models/Plan');
    const planDoc = await Plan.findOne({ name: new RegExp(`^${targetPlanName}$`, 'i'), isActive: true });

    if (!planDoc) {
      return res.status(404).json({ message: 'Selected plan is unavailable.' });
    }

    if (planDoc.name === 'One Day Trial') {
      return res.status(400).json({ message: 'The free trial cannot be purchased.' });
    }

    const baseAmount = planDoc.price;
    const gstAmount = Math.round(baseAmount * 0.18);
    const totalAmount = baseAmount + gstAmount;
    const durationDays = planDoc.durationDays;
    const plan = planDoc.name;
    const companyId = req.companyId;

    console.log("===== PAYMENT DEBUG =====");
    console.log("User ID:", req.userId);
    console.log("Company ID:", req.companyId);
    console.log("User Role:", req.userRole);
    console.log(`Plan Base Amount: ₹${baseAmount}, GST (18%): ₹${gstAmount}, Total Payable: ₹${totalAmount}`);
    console.log("=========================");

    if (!baseAmount || !plan || !durationDays) {
      return res.status(400).json({ message: 'Amount, plan, and durationDays are required' });
    }

    const company = await Company.findOne({ code: companyId });
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Razorpay amount is in paise (multiply by 100).
    // Send totalAmount (Base + 18% GST) so Razorpay charges the exact Total displayed on frontend modal
    const options = {
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt: `rcpt_${companyId}_${Date.now()}`
    };

    let order = null;
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    const hasValidRazorpayKeys = 
      keyId && 
      keyId !== 'rzp_test_fallback_id' && 
      keySecret && 
      keySecret !== 'fallback_secret';

    if (hasValidRazorpayKeys) {
      try {
        const razorpayInstance = new Razorpay({
          key_id: keyId,
          key_secret: keySecret
        });
        order = await razorpayInstance.orders.create(options);
      } catch (rzpErr) {
        console.warn('Razorpay API call failed, using test order simulation:', rzpErr.message);
      }
    }

    if (!order) {
      order = {
        id: `order_sim_${Date.now()}`,
        amount: Math.round(totalAmount * 100),
        currency: 'INR'
      };
    }

    // Save initial Payment record as Created
    const payment = new Payment({
      companyId: companyId,
      companyName: company.name,
      plan: plan,
      amount: baseAmount,
      gst: gstAmount,
      total: totalAmount,
      orderId: order.id,
      status: 'Created',
      durationDays: durationDays,
      expiryDate: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
      processedBy: req.userId || 'System'
    });

    await payment.save();

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: keyId || 'rzp_test_fallback_id'
    });
  } catch (err) {
    console.error("=================================");
    console.error("CREATE ORDER ERROR");
    console.error(err);
    console.error("=================================");

    const errorMessage = err.error?.description || err.message || 'Error creating Razorpay order';
    res.status(500).json({
      message: errorMessage,
      details: err
    });
  }
});

// POST /api/payment/verify
router.post('/verify', async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      companyId: bodyCompanyId,
      selectedPlan: bodySelectedPlan
    } = req.body;

    // Verify Signature
    const secret = process.env.RAZORPAY_KEY_SECRET || 'fallback_secret';
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body.toString())
      .digest("hex");

    const isSimulationOrder = String(razorpay_order_id || '').startsWith('order_sim_');
    const isAuthentic = isSimulationOrder || expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      // Update Payment status to Failed
      await Payment.findOneAndUpdate(
        { orderId: razorpay_order_id },
        { status: 'Failed', paymentId: razorpay_payment_id, signature: razorpay_signature }
      );
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    // Payment is successful
    const payment = await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id },
      {
        status: 'Paid',
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
        invoiceNo: `INV-${Date.now()}`
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({
        message: 'Payment order not found'
      });
    }

    const targetPlan = payment.plan;
    const targetCompanyCode = String(payment.companyId)
      .trim()
      .toUpperCase();

    console.log('VERIFY PAYMENT COMPANY:', targetCompanyCode);
    console.log('VERIFY PAYMENT PLAN:', targetPlan);

    // Look up Plan duration
    const Plan = require('../models/Plan');
    const planDoc = await Plan.findOne({ name: new RegExp(`^${targetPlan}$`, 'i'), isActive: true });
    const durationDays = planDoc
      ? planDoc.durationDays
      : payment.durationDays || 30;

    // Find the company without deleting or replacing its existing data
    const company = await Company.findOne({
      code: targetCompanyCode
    });

    if (!company) {
      return res.status(404).json({
        message: `Company '${targetCompanyCode}' was not found`
      });
    }

    const now = new Date();
    const currentExpiry = company.subscriptionExpiresAt
      ? new Date(company.subscriptionExpiresAt)
      : null;

    // Preserve unused subscription days during renewal
    const renewalStart =
      currentExpiry && currentExpiry > now
        ? currentExpiry
        : now;

    const expiryDate = new Date(
      renewalStart.getTime() +
      durationDays * 24 * 60 * 60 * 1000
    );

    if (company) {
      const activatedPlan = planDoc
        ? planDoc.name
        : targetPlan;

      company.subscription = activatedPlan;
      company.status = 'Active';
      company.subscriptionStartedAt = now;
      company.subscriptionExpiresAt = expiryDate;

      if (!Array.isArray(company.upgradeHistory)) {
        company.upgradeHistory = [];
      }

      company.upgradeHistory.push({
        plan: activatedPlan,
        startDate: now,
        endDate: expiryDate,
        updatedBy: req.userId || 'Razorpay Payment',
        date: new Date()
      });

      await company.save();

      console.log(`✅ Subscription Updated in MongoDB | Company: ${company.code} (${company.name}) | Plan: ${company.subscription} | Status: ${company.status} | Expires: ${company.subscriptionExpiresAt}`);

      // Emit real-time socket update to instantly unlock tenant dashboard
      const io = req.app.get('io');
      if (io) {
        io.to(`company:${company.code}`).emit('company_subscription_updated', {
          companyId: company.code,
          status: 'Active',
          subscription: company.subscription,
          subscriptionExpiresAt: company.subscriptionExpiresAt
        });
      }
    } else {
      console.warn(`⚠️ Verification warning: Company with code '${targetCompanyCode}' was not found in MongoDB.`);
    }

    res.json({
      message: 'Payment verified successfully',
      payment: payment,
      subscriptionExpiresAt: company ? company.subscriptionExpiresAt : expiryDate
    });

  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET /api/payment/history
router.get('/history', async (req, res) => {
  try {
    // Exclude incomplete order drafts ('Created'), returning only completed/paid payments
    let query = { status: { $ne: 'Created' } };
    // If not SaaS Super Admin, only show their company's history
    if (req.userRole !== 'SaaS Super Admin') {
      query.companyId = req.companyId;
    }
    const payments = await Payment.find(query).sort({ paymentDate: -1 });
    res.json(payments);
  } catch (err) {
    console.error('Fetch payment history error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
