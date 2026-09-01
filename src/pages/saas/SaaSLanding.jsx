import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Users, Clock, Building, CheckCircle2, Zap } from 'lucide-react';
import CommonFooter from '../../components/CommonFooter';

const SaaSLanding = () => {
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    mobileNumber: '',
    expectedBranches: 1,
    expectedEmployees: 1,
    message: ''
  });
  const [companyLogo, setCompanyLogo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);
    try {
      const registrationData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        registrationData.append(key, value);
      });
      if (companyLogo) {
        registrationData.append('companyLogo', companyLogo);
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/saas-leads/register`, {
        method: 'POST',
        body: registrationData
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setSubmitStatus({ type: 'success', message: result.message });
        setFormData({
          companyName: '', contactPerson: '', email: '', mobileNumber: '', expectedBranches: 1, expectedEmployees: 1, message: ''
        });
        setCompanyLogo(null);
      } else {
        setSubmitStatus({ type: 'error', message: result.message || 'Registration failed' });
      }
    } catch (error) {
      setSubmitStatus({ type: 'error', message: 'Network error. Please try again later.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.5 },
    viewport: { once: true }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Shield className="text-[#1E1B6E]" size={28} />
          <span className="text-xl font-bold text-[#1E1B6E]">FIC VMS</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/login" className="text-sm font-semibold text-gray-600 hover:text-[#1E1B6E]">Login</a>
          <a href="#register" className="bg-[#1E1B6E] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-900 transition-colors shadow-md">
            Start Free Demo
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-[#1E1B6E] text-white py-20 px-6 md:px-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10">
          <svg width="400" height="400" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path fill="#ffffff" d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,81.4,-46.2C91,-33.3,97.2,-17.6,98.1,-1.5C99,14.6,94.5,29.1,85.2,41.2C75.8,53.2,61.6,62.8,47.1,70.9C32.5,79,16.2,85.6,0.3,85.2C-15.7,84.7,-31.4,77.1,-45.5,68.4C-59.5,59.8,-71.9,50,-80.6,37.3C-89.3,24.6,-94.3,9,-93.6,-6.2C-92.8,-21.4,-86.3,-36.2,-76,-47.9C-65.6,-59.6,-51.4,-68.2,-37.2,-74.6C-22.9,-81,-8.5,-85.2,6.1,-95.7L44.7,-76.4Z" transform="translate(100 100)" />
          </svg>
        </div>
        
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 relative z-10">
          <motion.div className="flex-1 space-y-6" {...fadeInUp}>
            <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-sm font-semibold text-indigo-100 border border-white/20">
              <Zap size={14} className="text-yellow-400" />
              <span>Next-Gen Visitor Management</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Secure Your Workplace. <br/><span className="text-indigo-200">Simplify Your Check-ins.</span>
            </h1>
            <p className="text-lg md:text-xl text-indigo-100 max-w-lg">
              Enterprise-grade visitor management system tailored for modern businesses. Protect your premises with contactless check-ins, instant approvals, and real-time tracking.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row gap-4">
              <a href="#register" className="bg-white text-[#1E1B6E] px-8 py-3.5 rounded-lg font-bold text-center hover:bg-gray-50 transition-colors shadow-lg">
                Start Your Free Demo
              </a>
              <a href="#features" className="px-8 py-3.5 rounded-lg font-bold text-center border-2 border-indigo-400 text-white hover:bg-white/10 transition-colors">
                Explore Features
              </a>
            </div>
          </motion.div>
          <motion.div className="flex-1" initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 blur-3xl opacity-30 rounded-full"></div>
              <img 
                src="https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=1200&h=800" 
                alt="Modern Office" 
                className="rounded-2xl shadow-2xl relative z-10 border-4 border-white/10 object-cover h-[400px] w-full"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 md:px-12 bg-white">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Everything You Need to Manage Visitors</h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">A complete suite of tools designed to enhance security while providing a seamless experience for your guests.</p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <Clock size={24}/>, title: 'Pre-Booking', desc: 'Allow employees to pre-register guests, generating secure QR codes for instant check-ins upon arrival.' },
              { icon: <CheckCircle2 size={24}/>, title: 'Instant Approvals', desc: 'Hosts receive immediate notifications and can approve or deny entry directly from their devices.' },
              { icon: <Building size={24}/>, title: 'Multi-Branch Support', desc: 'Manage visitor flows across multiple locations, branches, and gates from a single centralized dashboard.' },
              { icon: <Shield size={24}/>, title: 'Security First', desc: 'Maintain digital logs, blacklist unwanted visitors, and track live entry/exit times for absolute safety.' },
              { icon: <Users size={24}/>, title: 'Tenant Segregation', desc: 'SaaS architecture ensures complete data privacy and isolation between different companies and tenants.' },
              { icon: <Zap size={24}/>, title: 'Real-time Analytics', desc: 'Gain insights into peak visitor hours, frequent guests, and security metrics with detailed reporting.' },
            ].map((feature, i) => (
              <motion.div key={i} className="bg-gray-50 p-8 rounded-2xl border border-gray-100 hover:shadow-lg transition-all hover:-translate-y-1" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.1 }} viewport={{ once: true }}>
                <div className="w-12 h-12 bg-indigo-100 text-[#1E1B6E] rounded-xl flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Registration Section */}
      <section id="register" className="py-20 px-6 md:px-12 bg-gray-50 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div className="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col lg:flex-row" {...fadeInUp}>
            <div className="lg:w-5/12 bg-[#1E1B6E] text-white p-10 flex flex-col justify-center">
              <h2 className="text-3xl font-bold mb-6">Ready to upgrade your security?</h2>
              <p className="text-indigo-100 mb-8 leading-relaxed">
                Join hundreds of companies that trust FIC VMS to protect their premises and streamline their front desk operations.
              </p>
              <ul className="space-y-4 mb-8">
                {['14-day free trial on Demo', 'No credit card required', 'Dedicated onboarding support', 'Cancel anytime'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-indigo-50">
                    <CheckCircle2 size={18} className="text-green-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:w-7/12 p-10">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Register for a Demo</h3>
              
              {submitStatus && (
                <div className={`p-4 rounded-lg mb-6 text-sm font-semibold ${submitStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {submitStatus.message}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Company Name *</label>
                    <input type="text" required value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="w-full border-gray-300 rounded-lg p-2.5 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="Acme Corp" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Contact Person *</label>
                    <input type="text" required value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} className="w-full border-gray-300 rounded-lg p-2.5 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Work Email *</label>
                    <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border-gray-300 rounded-lg p-2.5 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="john@acme.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number *</label>
                    <input type="tel" required value={formData.mobileNumber} onChange={e => setFormData({...formData, mobileNumber: e.target.value})} className="w-full border-gray-300 rounded-lg p-2.5 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="+91 9876543210" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Expected Branches</label>
                    <input type="number" min="1" value={formData.expectedBranches} onChange={e => setFormData({...formData, expectedBranches: parseInt(e.target.value)})} className="w-full border-gray-300 rounded-lg p-2.5 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Expected Employees</label>
                    <input type="number" min="1" value={formData.expectedEmployees} onChange={e => setFormData({...formData, expectedEmployees: parseInt(e.target.value)})} className="w-full border-gray-300 rounded-lg p-2.5 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Company Logo</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => setCompanyLogo(event.target.files[0])}
                    className="w-full border-gray-300 rounded-lg p-2.5 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG or WebP. Maximum size: 2 MB.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Message (Optional)</label>
                  <textarea rows="3" value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} className="w-full border-gray-300 rounded-lg p-2.5 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="Tell us about your specific requirements..."></textarea>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-[#1E1B6E] text-white py-3.5 rounded-lg font-bold text-lg hover:bg-indigo-900 transition-colors shadow-md disabled:opacity-70 flex justify-center items-center">
                  {isSubmitting ? <span className="animate-pulse">Submitting...</span> : 'Request Demo'}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      </section>

      <CommonFooter />
    </div>
  );
};

export default SaaSLanding;
