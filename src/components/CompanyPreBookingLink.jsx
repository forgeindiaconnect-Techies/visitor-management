import React from 'react';
import { Copy, Share2 } from 'lucide-react';

const CompanyPreBookingLink = ({ company }) => {
  if (!company?.code) {
    return null;
  }

  const preBookingLink =
    `${window.location.origin}/pre-booking/${company.code}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(
      preBookingLink
    );

    alert('Pre-booking link copied successfully');
  };

  const shareLink = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `${company.name} Visitor Registration`,
        text: `Use this link to register your visit to ${company.name}.`,
        url: preBookingLink
      });

      return;
    }

    await copyLink();
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow border border-gray-100 mb-6">
      <div className="flex items-center gap-4">
        {company.branding?.logoUrl ? (
          <img
            src={company.branding.logoUrl}
            alt={`${company.name} logo`}
            className="h-14 w-14 rounded-xl object-contain border border-gray-100 bg-slate-50 p-1"
          />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-lg">
            {company.name ? company.name.charAt(0).toUpperCase() : 'C'}
          </div>
        )}

        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Visitor Registration Link
          </h2>

          <p className="text-sm text-gray-500">
            Share this link with your visitors.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-gray-100 p-3 text-sm font-mono text-gray-700 break-all select-all border border-gray-200">
        {preBookingLink}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={copyLink}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
        >
          <Copy size={18} />
          Copy Link
        </button>

        <button
          type="button"
          onClick={shareLink}
          className="flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 transition shadow-sm"
        >
          <Share2 size={18} />
          Share Link
        </button>
      </div>
    </section>
  );
};

export default CompanyPreBookingLink;
