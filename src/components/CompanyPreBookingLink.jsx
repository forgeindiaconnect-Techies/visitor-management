import React from 'react';
import { Copy, Share2, ExternalLink, Link2, UserCheck, Calendar } from 'lucide-react';

const CompanyPreBookingLink = ({ company }) => {
  if (!company?.code) {
    return null;
  }

  const origin = import.meta.env.VITE_APP_URL || (window.location.hostname === 'localhost' ? 'https://visitor-management-indol.vercel.app' : window.location.origin);
  const visitorRegistrationLink = `${origin}/login?company=${company.code}`;
  const preBookingLink = `${origin}/pre-booking/${company.code}`;

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(`${label} copied successfully!`);
    } catch {
      alert(`Failed to copy ${label}`);
    }
  };

  const shareUrl = async (url, title, text) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    await copyToClipboard(url, title);
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow-md border border-gray-100 mb-6 space-y-6">
      {/* Header Info */}
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
        <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
          <Link2 size={20} />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-gray-900">
            Company Registration Links
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Dedicated registration links for {company.name || company.code} (Company ID: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-indigo-700 font-bold">{company.code}</code>)
          </p>
        </div>
      </div>

      {/* Grid containing two distinct links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Link 1: Visitor Registration & Login Link */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <UserCheck size={18} className="text-indigo-600" />
              Visitor Registration Link
            </div>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Share this link for visitors to register on-site or access the company visitor portal.
            </p>
            <div className="mt-3 rounded-lg bg-white p-2.5 text-xs font-mono text-indigo-900 break-all border border-indigo-100 shadow-2xs font-medium select-all">
              {visitorRegistrationLink}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => copyToClipboard(visitorRegistrationLink, 'Visitor Registration Link')}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition shadow-2xs cursor-pointer"
            >
              <Copy size={14} /> Copy
            </button>
            <button
              type="button"
              onClick={() => shareUrl(visitorRegistrationLink, 'Visitor Registration Link', `Register your visit to ${company.name}`)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-800 transition shadow-2xs cursor-pointer"
            >
              <Share2 size={14} /> Share
            </button>
            <a
              href={visitorRegistrationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-lg border border-indigo-200 bg-white p-2 text-indigo-700 hover:bg-indigo-50 transition"
              title="Open Link"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Link 2: Public Pre-Booking Link */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <Calendar size={18} className="text-amber-600" />
              Pre-Booking Registration Link
            </div>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Share this link with visitors to allow them to pre-register before visiting.
            </p>
            <div className="mt-3 rounded-lg bg-white p-2.5 text-xs font-mono text-amber-900 break-all border border-amber-200/80 shadow-2xs font-medium select-all">
              {preBookingLink}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => copyToClipboard(preBookingLink, 'Pre-Booking Link')}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50 transition shadow-2xs cursor-pointer"
            >
              <Copy size={14} /> Copy
            </button>
            <button
              type="button"
              onClick={() => shareUrl(preBookingLink, 'Pre-Booking Link', `Pre-book your visit to ${company.name}`)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition shadow-2xs cursor-pointer"
            >
              <Share2 size={14} /> Share
            </button>
            <a
              href={preBookingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-lg border border-amber-300 bg-white p-2 text-amber-800 hover:bg-amber-50 transition"
              title="Open Link"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

      </div>
    </section>
  );
};

export default CompanyPreBookingLink;
