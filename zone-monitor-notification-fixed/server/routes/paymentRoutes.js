const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Company = require('../models/Company');
const authMiddleware = require('../middleware/authMiddleware');


// Initialize Razorpay
// We use fallback keys if env vars are missing so the app doesn't crash during development
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_fallback_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'fallback_secret'
});

console.log("Razorpay Key:", process.env.RAZORPAY_KEY_ID);
console.log("Razorpay Secret Loaded:", !!process.env.RAZORPAY_KEY_SECRET);

router.use(authMiddleware);

// POST /api/payment/create-order
router.post('/create-order', async (req, res) => {
  try {
    const { amount, plan, durationDays } = req.body;
    const companyId = req.companyId;

    console.log("===== PAYMENT DEBUG =====");
    console.log("User ID:", req.userId);
    console.log("Company ID:", req.companyId);
    console.log("User Role:", req.userRole);
    console.log("Request Body:", req.body);
    console.log("=========================");

    if (!amount || !plan || !durationDays) {
      return res.status(400).json({ message: 'Amount, plan, and durationDays are required' });
    }

    const company = await Company.findOne({ code: companyId });
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Razorpay amount is in paise (multiply by 100)
    const options = {
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `rcpt_${companyId}_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    if (!order) {
      return res.status(500).json({ message: 'Error creating Razorpay order' });
    }

    // Save initial Payment record as Created
    const payment = new Payment({
      companyId: companyId,
      companyName: company.name,
      plan: plan,
      amount: amount - Math.round(amount * 0.18), // Base amount roughly
      gst: Math.round(amount * 0.18),
      total: amount,
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
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_fallback_id'
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const companyId = req.companyId;

    // Verify Signature
    const secret = process.env.RAZORPAY_KEY_SECRET || 'fallback_secret';
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

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
      return res.status(404).json({ message: 'Payment record not found' });
    }

    // Update Company Subscription
    const company = await Company.findOne({ code: companyId });
    company.subscription = payment.plan;
    company.status = 'Active';
    // Add duration to today
    company.subscriptionExpiresAt = new Date(Date.now() + payment.durationDays * 24 * 60 * 60 * 1000);
    await company.save();

    res.json({
      message: 'Payment verified successfully',
      payment: payment,
      subscriptionExpiresAt: company.subscriptionExpiresAt
    });

  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET /api/payment/history
router.get('/history', async (req, res) => {
  try {
    let query = {};
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
