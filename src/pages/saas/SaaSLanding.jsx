import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Users, 
  Clock, 
  Building, 
  CheckCircle2, 
  Zap, 
  QrCode, 
  Lock, 
  ArrowRight, 
  Sparkles, 
  ChevronDown, 
  FileText, 
  ShieldCheck, 
  Smartphone,
  Star,
  Check,
  ShieldAlert,
  Award,
  CheckSquare,
  XSquare
} from 'lucide-react';
import CommonFooter from '../../components/CommonFooter';

const demoPlans = [
  {
    id: 'trial',
    name: 'One Day Trial',
    price: 0,
    priceLabel: 'Free',
    validity: '24 Hours',
    visitorPasses: '25 Passes',
    branches: '1 Branch',
    users: '3 Users',
    popular: false,
    badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    btnBg: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md',
    features: [
      'QR Visitor Passes',
      'Instant Check-in / Check-out',
      'Pre-booking link generation',
      'Email Notifications',
      'Basic Dashboard Analytics'
    ]
  },
  {
    id: 'basic',
    name: 'Basic',
    price: 1999,
    priceLabel: '₹1,999',
    validity: '30 Days',
    visitorPasses: '500 Passes / Mo',
    branches: '1 Branch',
    users: '10 Users (5 Security)',
    popular: false,
    badgeBg: 'bg-blue-100 text-[#005BAA] border-blue-200',
    btnBg: 'bg-[#005BAA] hover:bg-[#004887] text-white shadow-md',
    features: [
      'All Trial Features Included',
      '500 Visitor Passes Monthly',
      'ID Proof Photo Storage',
      'Standard Exportable Reports',
      'Host Email & Web Alerts'
    ]
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 4999,
    priceLabel: '₹4,999',
    validity: '30 Days',
    visitorPasses: '3,000 Passes / Mo',
    branches: '5 Branches',
    users: '50 Users (25 Security)',
    popular: true,
    badgeBg: 'bg-[#E6B800] text-slate-900 border-yellow-300 font-extrabold',
    btnBg: 'bg-gradient-to-r from-[#005BAA] via-blue-700 to-[#003B73] hover:from-[#004887] hover:to-[#002D59] text-white shadow-xl shadow-blue-900/30',
    features: [
      'All Basic Features Included',
      '3,000 Visitor Passes Monthly',
      '5 Multi-Branch Locations',
      'AI Document OCR Verification',
      'Custom Branding & Email Pass',
      'Advanced Security Analytics'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 9999,
    priceLabel: '₹9,999',
    validity: '30 Days',
    visitorPasses: 'Unlimited Passes',
    branches: 'Unlimited Branches',
    users: 'Unlimited Users',
    popular: false,
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    btnBg: 'bg-amber-600 hover:bg-amber-700 text-white shadow-md',
    features: [
      'Unlimited Visitor Passes',
      'Unlimited Branches & Gates',
      'Unlimited System & Host Users',
      'API Access & Webhooks',
      'Custom Domain Support',
      'Dedicated 24/7 Account Support'
    ]
  }
];

const featureComparison = [
  { feature: 'Contactless QR Code Pre-Booking', vms: true, paper: false, basic: true },
  { feature: 'AI Document OCR (Aadhaar / PAN / Passport)', vms: true, paper: false, basic: false },
  { feature: 'Instant WhatsApp & Email Host Notifications', vms: true, paper: false, basic: true },
  { feature: 'Watchlist & Blacklist Gate Security Block', vms: true, paper: false, basic: false },
  { feature: 'Multi-Branch & Multi-Gate Control Panel', vms: true, paper: false, basic: false },
  { feature: '1-Click Audit Log Export (Excel / CSV)', vms: true, paper: false, basic: true },
  { feature: 'E-Signatures & Digital Waiver Compliance', vms: true, paper: false, basic: false },
  { feature: 'Zero Extra Hardware Required (Browser Based)', vms: true, paper: false, basic: true }
];

const faqs = [
  {
    q: 'How fast can our company start using ForgeIndia VMS?',
    a: 'You can go live in under 5 minutes. Complete the registration form, pick your trial or plan, and your dedicated login and pre-booking links are activated instantly.'
  },
  {
    q: 'Does ForgeIndia VMS require proprietary hardware or scanners?',
    a: 'No proprietary hardware required! Security guards, receptionists, and hosts can use any smartphone, tablet, iPad, or laptop browser to scan QR codes and approve visitors.'
  },
  {
    q: 'How does ID Proof validation work?',
    a: 'ForgeIndia VMS includes built-in AI OCR document verification for Aadhaar Cards, PAN Cards, Driving Licences, and Passports. Unreadable uploads trigger manual security review alerts.'
  },
  {
    q: 'Can we manage multiple branches and gates from one account?',
    a: 'Yes! Standard and Enterprise plans support multi-branch management, allowing central security directors to monitor all gates and offices from a single master dashboard.'
  }
];

const SaaSLanding = () => {
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    mobileNumber: '',
    requestedPlan: 'Standard',
    message: ''
  });
  const [companyLogo, setCompanyLogo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [activeFaq, setActiveFaq] = useState(null);
  const [monthlyVisitors, setMonthlyVisitors] = useState(1000);

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

      const configuredUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const baseUrl = configuredUrl.replace(/\/+$/, '').replace(/\/api$/, '');

      const response = await fetch(`${baseUrl}/api/saas-leads/register`, {
        method: 'POST',
        body: registrationData
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setSubmitStatus({ type: 'success', message: result.message || 'Registration successful! Check your email for login details.' });
        setFormData({
          companyName: '', contactPerson: '', email: '', mobileNumber: '', requestedPlan: 'Standard', message: ''
        });
        setCompanyLogo(null);
      } else {
        setSubmitStatus({ type: 'error', message: result.message || 'Registration failed. Please verify your input.' });
      }
    } catch (error) {
      console.error('Registration submit error:', error);
      setSubmitStatus({ type: 'error', message: error.message || 'Network error. Please try again.' });
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-[#005BAA] selection:text-white">
      
      {/* 1. Official Forge India Top Banner */}
      <div className="bg-[#003B73] text-white py-2 px-4 text-center text-xs font-semibold flex items-center justify-center gap-2 border-b border-[#002D59]">
        <Award size={14} className="text-[#E6B800]" />
        <span>Rated <strong>4.9 / 5.0</strong> on SoftwareAdvice & Capterra — Rated #1 Visitor Management Software 2026</span>
        <a href="#pricing" className="underline text-[#E6B800] ml-2 hover:text-white">View Plans & Pricing →</a>
      </div>

      {/* 2. Header Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/95 border-b border-slate-200 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-3.5 flex justify-between items-center">
          <a href="#" className="flex items-center gap-3 group">
            <img 
              src="/forge-india-logo.svg" 
              alt="Forge India Connect Logo" 
              className="h-10 w-auto object-contain transition-transform group-hover:scale-105" 
            />
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-[#005BAA] flex items-center gap-1.5">
                FORGE INDIA <span className="text-[#E6B800]">VMS</span>
              </span>
              <span className="text-[9px] tracking-widest text-slate-500 uppercase font-extrabold">SHAPING FUTURE • PVT. LTD</span>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-700">
            <a href="#features" className="hover:text-[#005BAA] transition-colors">Features</a>
            <a href="#comparison" className="hover:text-[#005BAA] transition-colors">Comparison</a>
            <a href="#calculator" className="hover:text-[#005BAA] transition-colors">ROI Calculator</a>
            <a href="#pricing" className="hover:text-[#005BAA] transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-[#005BAA] transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-4">
            <a 
              href="/login" 
              className="text-sm font-bold text-slate-700 hover:text-[#005BAA] px-4 py-2 rounded-xl transition-colors"
            >
              Sign In
            </a>
            <a 
              href="#register" 
              className="bg-[#005BAA] hover:bg-[#004887] text-white px-5 py-2.5 rounded-xl text-sm font-extrabold shadow-md hover:shadow-lg transition-all hover:scale-105 flex items-center gap-2"
            >
              <span>Start Free Demo</span>
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </header>

      {/* 3. Hero Section - Royal Forge Blue (#005BAA) Palette */}
      <section className="relative pt-16 pb-24 lg:pt-20 lg:pb-28 px-6 lg:px-12 overflow-hidden bg-gradient-to-b from-[#003B73] via-[#005BAA] to-[#004887] text-white">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            
            {/* Top Rating Pill */}
            <motion.div 
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-blue-100 text-xs font-bold tracking-wide uppercase shadow-inner"
              {...fadeInUp}
            >
              <div className="flex text-[#E6B800] gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={12} className="fill-current" />
                ))}
              </div>
              <span>4.9 / 5.0 Rating • Official Forge India Enterprise VMS</span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1 
              className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Secure Your Premises.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400">
                Automate Gate Check-Ins.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p 
              className="text-lg sm:text-xl text-blue-100/90 font-normal max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              ForgeIndia VMS delivers contactless QR pass pre-booking, AI OCR document verification, instant host WhatsApp/email alerts, and real-time multi-branch gate control.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div 
              className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <a 
                href="#register" 
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-extrabold text-base text-[#005BAA] bg-white hover:bg-slate-100 shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
              >
                <span>Start Your Free Demo</span>
                <ArrowRight size={18} />
              </a>

              <a 
                href="#features" 
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-base text-white border-2 border-white/30 hover:bg-white/10 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                <QrCode size={18} className="text-[#E6B800]" />
                <span>Explore Features</span>
              </a>
            </motion.div>
          </div>

          {/* Hero Visual Video / Interactive Mockup */}
          <motion.div 
            className="mt-16 relative max-w-5xl mx-auto"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="relative rounded-2xl p-3 bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
              <div className="overflow-hidden rounded-xl bg-slate-900 border border-slate-800">
                
                {/* High-Definition HTML5 Video Player with Local Override */}
                <div className="relative aspect-video w-full overflow-hidden rounded-xl shadow-2xl border border-slate-700 bg-slate-950">
                  <video 
                    controls
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    poster="/hero-dashboard.jpg"
                    className="w-full h-full object-cover rounded-xl"
                  >
                    <source src="/vms-demo.mp4" type="video/mp4" />
                    <source src="https://assets.mixkit.co/videos/preview/mixkit-security-guard-monitoring-surveillance-screens-41484-large.mp4" type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
                <div className="p-6 space-y-6 text-left text-white">
                  
                  {/* Top Header Bar */}
                  <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-xs text-slate-400 font-mono ml-2">forgeindia-vms.live</span>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 text-xs px-3 py-1 rounded-full font-bold border border-emerald-500/20">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>Gate Security Online • Main Branch</span>
                    </div>
                  </div>

                  {/* Metric Cards Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
                      <p className="text-xs text-slate-400 font-semibold">Total Visitors Today</p>
                      <p className="text-2xl font-extrabold text-white mt-1">145</p>
                      <p className="text-[10px] text-emerald-400 font-bold mt-1">▲ +14% vs yesterday</p>
                    </div>
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
                      <p className="text-xs text-slate-400 font-semibold">Gate Check-ins</p>
                      <p className="text-2xl font-extrabold text-[#E6B800] mt-1">89</p>
                      <p className="text-[10px] text-amber-300 font-bold mt-1">⚡ Under 4 sec scan</p>
                    </div>
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
                      <p className="text-xs text-slate-400 font-semibold">Pending Approvals</p>
                      <p className="text-2xl font-extrabold text-amber-400 mt-1">12</p>
                      <p className="text-[10px] text-amber-300 font-bold mt-1">⌛ Host Alert Sent</p>
                    </div>
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
                      <p className="text-xs text-slate-400 font-semibold">Inside Premises</p>
                      <p className="text-2xl font-extrabold text-emerald-400 mt-1">34</p>
                      <p className="text-[10px] text-emerald-300 font-bold mt-1">🟢 Live Security Log</p>
                    </div>
                  </div>

                  {/* Live Stream & Scanner Split Card */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-[#003B73] to-slate-900 p-5 rounded-xl border border-blue-500/30 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-2xl bg-[#005BAA]/30 text-[#E6B800] flex items-center justify-center mb-3 border border-yellow-500/30">
                        <QrCode size={36} className="animate-pulse" />
                      </div>
                      <p className="text-sm font-extrabold text-white">Contactless Gate Scanner</p>
                      <p className="text-xs text-blue-200 mt-1">Place QR Pass Under Reader</p>
                      <div className="mt-3 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-[11px] font-bold rounded-lg border border-emerald-500/30">
                        ✓ Instant Host Notification
                      </div>
                    </div>

                    <div className="md:col-span-2 bg-slate-800/60 p-4 rounded-xl border border-slate-700">
                      <div className="flex justify-between items-center mb-3">
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Live Gate Activity Log</p>
                        <span className="text-[10px] text-slate-400">Updated just now</span>
                      </div>
                      <div className="space-y-2">
                        {[
                          { name: 'Sarah Chen', company: 'Google', time: '10:45 AM', status: 'Checked In', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
                          { name: 'Rajesh Kumar', company: 'TCS', time: '10:42 AM', status: 'Approved', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
                          { name: 'Michael Rossi', company: 'Microsoft', time: '10:38 AM', status: 'Checked Out', color: 'bg-slate-700 text-slate-300 border-slate-600' }
                        ].map((v, i) => (
                          <div key={i} className="flex justify-between items-center p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-[#005BAA] text-white font-bold flex items-center justify-center text-[10px]">
                                {v.name.split(' ').map(n=>n[0]).join('')}
                              </div>
                              <div>
                                <p className="font-bold text-white">{v.name}</p>
                                <p className="text-[10px] text-slate-400">{v.company} • {v.time}</p>
                              </div>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${v.color}`}>
                              {v.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Overlay Badge Left */}
              <div className="absolute -left-6 bottom-12 hidden lg:flex items-center gap-3 bg-white border border-slate-200 p-4 rounded-2xl shadow-2xl text-slate-900">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Live Gate Summary</p>
                  <p className="text-sm font-extrabold text-slate-900">🟢 Live Feed Active</p>
                </div>
              </div>

              {/* Floating Overlay Badge Right */}
              <div className="absolute -right-6 top-12 hidden lg:flex items-center gap-3 bg-white border border-slate-200 p-4 rounded-2xl shadow-2xl text-slate-900">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#005BAA] flex items-center justify-center font-bold">
                  <QrCode size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold">Check-In Speed</p>
                  <p className="text-sm font-extrabold text-slate-900">⚡ Under 4 Seconds</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 4. SoftwareAdvice Market Metrics */}
      <section className="py-10 bg-white border-b border-slate-200 shadow-sm relative">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-3xl lg:text-4xl font-extrabold text-[#005BAA]">99.99%</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mt-1">Platform Uptime SLA</p>
          </div>
          <div>
            <p className="text-3xl lg:text-4xl font-extrabold text-amber-600">&lt; 4 Sec</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mt-1">Average Check-in Speed</p>
          </div>
          <div>
            <p className="text-3xl lg:text-4xl font-extrabold text-[#005BAA]">500+</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mt-1">Enterprise Clients</p>
          </div>
          <div>
            <p className="text-3xl lg:text-4xl font-extrabold text-emerald-600">100%</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mt-1">Aadhaar & PAN Compliant</p>
          </div>
        </div>
      </section>

      {/* 5. Essential Features Grid */}
      <section id="features" className="py-24 px-6 lg:px-12 bg-slate-50 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center max-w-3xl mx-auto mb-16 space-y-4" {...fadeInUp}>
            <span className="text-xs font-bold uppercase tracking-widest text-[#005BAA] bg-blue-100 px-3.5 py-1.5 rounded-full border border-blue-200">
              Essential VMS Capabilities
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900">
              Ranked #1 Visitor Management Software
            </h2>
            <p className="text-slate-600 text-base sm:text-lg">
              Engineered with the essential capabilities rated highest by enterprise buyers on SoftwareAdvice.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <Clock size={24} className="text-[#005BAA]" />,
                title: 'Contactless Pre-Booking & QR Passes',
                desc: 'Generate secure digital QR passes for guests prior to arrival. Visitors scan at reception for instant check-in.'
              },
              {
                icon: <ShieldCheck size={24} className="text-[#005BAA]" />,
                title: 'AI Photo & ID Verification',
                desc: 'Automated OCR document validation for Aadhaar, PAN, Driving Licence, and Passport with instant security alerts.'
              },
              {
                icon: <Smartphone size={24} className="text-emerald-600" />,
                title: 'Instant Host Approval Alerts',
                desc: 'Send real-time WhatsApp, SMS, and Email notifications to hosts upon arrival for instant gate approval.'
              },
              {
                icon: <Building size={24} className="text-[#005BAA]" />,
                title: 'Multi-Branch & Multi-Gate Support',
                desc: 'Centralize management for multiple office locations, gates, and reception kiosks from one single dashboard.'
              },
              {
                icon: <Lock size={24} className="text-red-600" />,
                title: 'Watchlist & Threat Protection',
                desc: 'Maintain blacklisted visitor records and trigger real-time gate security alerts to prevent unauthorized access.'
              },
              {
                icon: <FileText size={24} className="text-amber-600" />,
                title: '1-Click Audit Reporting',
                desc: 'Export complete visitor logs, attendance records, and branch traffic trends in Excel/CSV format anytime.'
              }
            ].map((feature, i) => (
              <motion.div 
                key={i} 
                className="p-8 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                viewport={{ once: true }}
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-6 group-hover:bg-[#005BAA] group-hover:text-white transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-[#005BAA] transition-colors">{feature.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. SoftwareAdvice Comparison Matrix */}
      <section id="comparison" className="py-24 px-6 lg:px-12 bg-white relative">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center max-w-3xl mx-auto mb-16 space-y-4" {...fadeInUp}>
            <span className="text-xs font-bold uppercase tracking-widest text-[#005BAA] bg-blue-100 px-3.5 py-1.5 rounded-full border border-blue-200">
              Why Upgrade
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900">
              ForgeIndia VMS vs Traditional Paper Logs
            </h2>
            <p className="text-slate-600 text-base sm:text-lg">
              See why leading companies replace outdated paper logbooks with ForgeIndia VMS.
            </p>
          </motion.div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#005BAA] text-white text-sm">
                  <th className="p-4 font-bold">Feature / Capability</th>
                  <th className="p-4 font-bold text-center bg-[#003B73]">ForgeIndia VMS</th>
                  <th className="p-4 font-bold text-center">Paper Register Logs</th>
                  <th className="p-4 font-bold text-center">Basic Visitor Apps</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm bg-white">
                {featureComparison.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-4 font-semibold text-slate-800">{row.feature}</td>
                    <td className="p-4 text-center bg-blue-50/50">
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-extrabold">
                        <CheckSquare size={18} /> Yes
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center gap-1 text-red-500 font-semibold">
                        <XSquare size={18} /> No
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {row.basic ? (
                        <span className="text-emerald-600 font-semibold">✓ Included</span>
                      ) : (
                        <span className="text-slate-400 font-semibold">— Limited</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 7. Interactive ROI Estimator */}
      <section id="calculator" className="py-24 px-6 lg:px-12 bg-slate-100 relative">
        <div className="max-w-5xl mx-auto bg-white p-8 lg:p-12 rounded-3xl border border-slate-200 shadow-xl">
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#005BAA] bg-blue-100 px-3 py-1 rounded-full border border-blue-200">
              Interactive ROI Estimator
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900">Calculate Your Front Desk Time Savings</h2>
            <p className="text-slate-600 text-sm">Adjust monthly visitor volume to estimate hours saved and check-in speed boost.</p>
          </div>

          <div className="space-y-8">
            <div className="space-y-3 max-w-xl mx-auto">
              <div className="flex justify-between items-center text-sm font-bold text-slate-800">
                <span>Monthly Visitors: <strong className="text-[#005BAA] text-base">{monthlyVisitors.toLocaleString()} Visitors</strong></span>
              </div>
              <input 
                type="range" 
                min="100" 
                max="10000" 
                step="100" 
                value={monthlyVisitors} 
                onChange={e => setMonthlyVisitors(parseInt(e.target.value, 10))} 
                className="w-full accent-[#005BAA] cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-center">
              <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100">
                <p className="text-xs font-bold text-slate-500 uppercase">Check-in Time Reduced</p>
                <p className="text-3xl font-black text-[#005BAA] mt-1">{Math.round((monthlyVisitors * 4) / 60)} Hours / Mo</p>
                <p className="text-xs text-slate-500 mt-1">Saved for Front Desk Staff</p>
              </div>
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100">
                <p className="text-xs font-bold text-slate-500 uppercase">Check-in Speed</p>
                <p className="text-3xl font-black text-emerald-700 mt-1">3.5 Seconds</p>
                <p className="text-xs text-slate-500 mt-1">Avg Contactless QR Pass Scan</p>
              </div>
              <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100">
                <p className="text-xs font-bold text-slate-500 uppercase">Paper Waste Saved</p>
                <p className="text-3xl font-black text-amber-700 mt-1">{monthlyVisitors * 2} Pages / Mo</p>
                <p className="text-xs text-slate-500 mt-1">100% Paperless Digital Logs</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Pricing Grid Section */}
      <section id="pricing" className="py-24 px-6 lg:px-12 bg-white relative">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center max-w-3xl mx-auto mb-16 space-y-4" {...fadeInUp}>
            <span className="text-xs font-bold uppercase tracking-widest text-[#005BAA] bg-blue-100 px-3.5 py-1.5 rounded-full border border-blue-200">
              Subscription Plans
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900">
              Transparent Plans for Every Enterprise
            </h2>
            <p className="text-slate-600 text-base sm:text-lg">
              Start with our free 1-Day Trial or choose a plan scaled to your visitor volume.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {demoPlans.map((plan) => (
              <motion.div 
                key={plan.id}
                className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 bg-white border ${
                  plan.popular 
                    ? 'border-[#005BAA] shadow-2xl ring-2 ring-[#005BAA]/20 scale-[1.03] z-10' 
                    : 'border-slate-200 hover:border-slate-300 shadow-md hover:shadow-xl'
                }`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#005BAA] text-white text-xs font-black uppercase tracking-wider shadow-md flex items-center gap-1">
                    <Star size={12} className="fill-current text-[#E6B800]" />
                    <span>Most Popular</span>
                  </div>
                )}

                <div>
                  <div className="mb-6">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-4 ${plan.badgeBg}`}>
                      {plan.name}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-slate-900">{plan.priceLabel}</span>
                      <span className="text-slate-500 text-xs font-semibold">/ {plan.validity}</span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-8 pb-6 border-b border-slate-100 text-xs text-slate-700 font-bold">
                    <p className="flex items-center gap-2">
                      <Check size={14} className="text-[#005BAA]" />
                      <span>{plan.visitorPasses}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Check size={14} className="text-[#005BAA]" />
                      <span>{plan.branches}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Check size={14} className="text-[#005BAA]" />
                      <span>{plan.users}</span>
                    </p>
                  </div>

                  <ul className="space-y-3 mb-8 text-sm text-slate-600">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a 
                  href="#register"
                  onClick={() => setFormData(prev => ({ ...prev, requestedPlan: plan.name }))}
                  className={`w-full py-3.5 rounded-xl font-extrabold text-sm text-center transition-all ${plan.btnBg}`}
                >
                  Select {plan.name}
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Registration Form Section */}
      <section id="register" className="py-24 px-6 lg:px-12 bg-slate-100 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col lg:flex-row" {...fadeInUp}>
            
            {/* Left Info Column */}
            <div className="lg:w-5/12 bg-[#005BAA] text-white p-10 lg:p-12 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center font-bold">
                  <Shield size={26} className="text-[#E6B800]" />
                </div>
                <h2 className="text-3xl font-extrabold leading-tight">
                  Ready to Secure Your Premises?
                </h2>
                <p className="text-blue-100 text-sm leading-relaxed">
                  Join hundreds of companies that trust ForgeIndia VMS to protect their premises and streamline front desk operations.
                </p>
                <div className="space-y-4 pt-4">
                  {[
                    'Instant Demo Account Activation',
                    'No Credit Card Required',
                    'Multi-Branch & Gate Ready',
                    'Dedicated Technical Support'
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-blue-50 font-semibold">
                      <CheckCircle2 size={18} className="text-emerald-400" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t border-blue-400/20 mt-8">
                <p className="text-xs text-blue-200">Company: Forge India Connect Pvt. Ltd.</p>
                <p className="text-sm font-bold text-white mt-1">Support: support@forgeindia.in</p>
              </div>
            </div>

            {/* Right Registration Form */}
            <div className="lg:w-7/12 p-8 lg:p-12 bg-white">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Request Demo & Instant Access</h3>
              <p className="text-slate-500 text-sm mb-6">Fill in your company details to activate your trial.</p>

              {submitStatus && (
                <div className={`p-4 rounded-xl mb-6 text-sm font-bold border ${submitStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                  {submitStatus.message}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Company Name *</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.companyName} 
                      onChange={e => setFormData({...formData, companyName: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#005BAA] focus:border-[#005BAA] outline-none transition" 
                      placeholder="Acme Corp" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Contact Person *</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.contactPerson} 
                      onChange={e => setFormData({...formData, contactPerson: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#005BAA] focus:border-[#005BAA] outline-none transition" 
                      placeholder="John Doe" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Work Email *</label>
                    <input 
                      type="email" 
                      required 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#005BAA] focus:border-[#005BAA] outline-none transition" 
                      placeholder="john@acme.com" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Mobile Number *</label>
                    <input 
                      type="tel" 
                      required 
                      value={formData.mobileNumber} 
                      onChange={e => setFormData({...formData, mobileNumber: e.target.value})} 
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#005BAA] focus:border-[#005BAA] outline-none transition" 
                      placeholder="+91 9876543210" 
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Choose Plan *</label>
                    <select 
                      value={formData.requestedPlan} 
                      onChange={e => setFormData({...formData, requestedPlan: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#005BAA] focus:border-[#005BAA] outline-none transition"
                    >
                      <option value="One Day Trial">One Day Trial — Free — 25 Passes — 1 Branch</option>
                      <option value="Basic">Basic — ₹1,999 / Mo — 500 Passes — 1 Branch</option>
                      <option value="Standard">Standard — ₹4,999 / Mo — 3,000 Passes — 5 Branches (Most Popular)</option>
                      <option value="Enterprise">Enterprise — ₹9,999 / Mo — Unlimited Passes & Branches</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Company Logo (Optional)</label>
                  <input 
                    type="file" 
                    accept="image/png,image/jpeg,image/webp" 
                    onChange={e => setCompanyLogo(e.target.files[0])} 
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-600 outline-none file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#005BAA] file:text-white hover:file:bg-[#004887]" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Additional Requirements (Optional)</label>
                  <textarea 
                    rows="2" 
                    value={formData.message} 
                    onChange={e => setFormData({...formData, message: e.target.value})} 
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:ring-2 focus:ring-[#005BAA] focus:border-[#005BAA] outline-none transition" 
                    placeholder="Tell us about your specific requirements..."
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full py-4 rounded-xl font-extrabold text-base text-white bg-[#005BAA] hover:bg-[#004887] shadow-xl shadow-blue-900/20 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <span className="animate-pulse">Submitting...</span> : (
                    <>
                      <span>Request Demo</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 10. FAQ Accordion Section */}
      <section id="faq" className="py-24 px-6 lg:px-12 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.div className="text-center mb-16 space-y-4" {...fadeInUp}>
            <span className="text-xs font-bold uppercase tracking-widest text-[#005BAA] bg-blue-100 px-3.5 py-1.5 rounded-full border border-blue-200">
              Frequently Asked Questions
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">Got Questions? We’ve Got Answers.</h2>
          </motion.div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div 
                key={i} 
                className="rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden transition-colors"
              >
                <button 
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  className="w-full p-6 text-left font-bold text-slate-900 flex justify-between items-center gap-4 hover:text-[#005BAA] transition-colors"
                >
                  <span className="text-base sm:text-lg">{faq.q}</span>
                  <ChevronDown size={20} className={`shrink-0 transition-transform ${activeFaq === i ? 'rotate-180 text-[#005BAA]' : 'text-slate-400'}`} />
                </button>
                <AnimatePresence>
                  {activeFaq === i && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="px-6 pb-6 text-sm text-slate-600 leading-relaxed border-t border-slate-200 pt-4"
                    >
                      {faq.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CommonFooter />
    </div>
  );
};

export default SaaSLanding;
