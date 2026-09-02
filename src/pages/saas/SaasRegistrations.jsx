import React from 'react';
import { Calendar } from 'lucide-react';

const SaasRegistrations = ({ saasLeads, updateStatus, setSelectedLead, setActiveLeadTab, loading }) => {
  return (
    <div className="overflow-x-auto pb-2">
      <table className="w-full text-left border-collapse min-w-max">
        <thead>
          <tr className="bg-slate-50 text-gray-500 text-[11px] uppercase tracking-wider">
            <th className="px-6 py-4 font-medium">Company Name</th>
            <th className="px-6 py-4 font-medium">Contact</th>
            <th className="px-6 py-4 font-medium">Expected Size</th>
            <th className="px-6 py-4 font-medium">Date</th>
            <th className="px-6 py-4 font-medium">Status</th>
            <th className="px-6 py-4 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {saasLeads.map((lead) => (
            <tr key={lead._id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4 font-semibold text-gray-900">
                <div className="flex items-center gap-3">
                  {lead.logoUrl ? (
                    <img 
                      src={lead.logoUrl} 
                      alt={`${lead.companyName} logo`} 
                      className="w-8 h-8 rounded object-contain bg-white shrink-0 shadow-sm border border-gray-100" 
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#1E1B6E] font-bold shrink-0 text-xs">
                      {lead.companyName ? lead.companyName.charAt(0).toUpperCase() : 'C'}
                    </div>
                  )}
                  <span>{lead.companyName}</span>
                </div>
              </td>
              <td className="px-6 py-4 font-semibold text-gray-700">
                {lead.contactPerson}
                <div className="text-xs font-normal text-gray-500">{lead.email} | {lead.mobileNumber}</div>
              </td>
              <td className="px-6 py-4 text-xs font-medium text-gray-600">
                {lead.expectedBranches} Branch(es), {lead.expectedEmployees} Emp.
              </td>
              <td className="px-6 py-4 text-xs font-medium text-gray-600">
                <div className="flex items-center space-x-1.5">
                  <Calendar size={13} className="text-gray-400" />
                  <span>{new Date(lead.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-xs">
                <select
                  value={lead.status}
                  onChange={(event) =>
                    updateStatus(lead._id, event.target.value)
                  }
                  className="px-2 py-1 border rounded bg-white text-xs"
                >
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Demo Scheduled">
                    Demo Scheduled
                  </option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Won">Won</option>
                  <option value="Lost">Lost</option>
                </select>
              </td>
              <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                <button 
                  type="button"
                  onClick={() => { setSelectedLead(lead); if (setActiveLeadTab) setActiveLeadTab('details'); }}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded transition-colors inline-block mr-2"
                >
                  View Details
                </button>
                {lead.status === 'Won' &&
                 !lead.convertedCompanyId && (
                  <button
                    type="button"
                    onClick={() => { setSelectedLead(lead); if (setActiveLeadTab) setActiveLeadTab('convert'); }}
                    className="rounded-lg bg-indigo-700 px-4 py-2 text-white text-xs font-bold shadow hover:bg-indigo-800 transition"
                  >
                    Create Dashboard
                  </button>
                )}

                {lead.convertedCompanyId && (
                  <span className="font-semibold text-green-700 text-xs bg-green-50 px-2.5 py-1 rounded inline-block">
                    Dashboard Created
                  </span>
                )}
              </td>
            </tr>
          ))}
          {saasLeads.length === 0 && !loading && (
            <tr>
              <td colSpan="6" className="px-6 py-12 text-center text-gray-500 font-medium bg-slate-50/50">
                No sales leads found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SaasRegistrations;
