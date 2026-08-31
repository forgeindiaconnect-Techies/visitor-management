import React from 'react';
import { X, Download, FileText } from 'lucide-react';

const InvoiceModal = ({ invoice, onClose }) => {
  if (!invoice) return null;

  const handleDownload = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - ${invoice.invoiceNo || 'Pending'}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Inter', sans-serif; padding: 0; margin: 0; color: #1f2937; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .invoice-container { max-width: 900px; margin: 0 auto; padding: 20px; }
            .header-banner { background: #1E1B6E; color: white; padding: 30px 40px; border-radius: 16px 16px 0 0; display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
            .header-banner h1 { margin: 0; font-size: 32px; font-weight: 800; letter-spacing: 1px; }
            .header-banner .invoice-no { opacity: 0.8; font-size: 15px; margin-top: 5px; }
            .header-banner .company-info { text-align: right; }
            .header-banner .company-info h2 { margin: 0; font-size: 22px; font-weight: 700; }
            .header-banner .company-info p { margin: 3px 0 0 0; opacity: 0.8; font-size: 13px; }
            
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; padding: 0 40px; }
            .meta-box { background: #f8fafc; padding: 15px 20px; border-radius: 12px; border: 1px solid #e2e8f0; }
            .meta-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 6px; display: block; }
            .meta-value { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
            .meta-sub { font-size: 13px; color: #475569; }
            
            .badge { display: inline-block; padding: 4px 10px; background: #dcfce7; color: #166534; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 8px; }
            
            table { width: calc(100% - 80px); margin: 0 40px 30px 40px; border-collapse: separate; border-spacing: 0; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
            th, td { padding: 12px 20px; text-align: left; }
            thead { background: #f8fafc; }
            th { text-transform: uppercase; font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1px; border-bottom: 1px solid #e2e8f0; }
            td { border-bottom: 1px solid #f1f5f9; font-size: 14px; }
            tbody tr:last-child td { border-bottom: none; }
            .text-right { text-align: right; }
            
            .total-section { display: flex; justify-content: flex-end; padding: 0 40px; margin-bottom: 30px; }
            .total-box { background: #1E1B6E; color: white; padding: 20px 24px; border-radius: 12px; width: 280px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; opacity: 0.9; }
            .total-row.final { border-top: 1px solid rgba(255,255,255,0.2); padding-top: 12px; margin-top: 12px; margin-bottom: 0; font-size: 20px; font-weight: 800; opacity: 1; }
            
            .footer { text-align: center; padding: 20px 40px; background: #f8fafc; border-radius: 0 0 16px 16px; margin-top: auto; }
            .footer p { margin: 4px 0; color: #64748b; font-size: 12px; font-weight: 500; }
            
            @page { margin: 10mm; }
            @media print {
              html, body { height: 100vh; overflow: hidden; }
              .invoice-container { padding: 0; height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
              .footer { margin-top: 0; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <div class="header-banner">
              <div>
                <h1>INVOICE</h1>
                <div class="invoice-no">#${invoice.invoiceNo || 'INV-PENDING'}</div>
              </div>
              <div class="company-info">
                <h2>FIC VMS</h2>
                <p>Enterprise SaaS Platform</p>
              </div>
            </div>

            <div class="info-grid">
              <div class="meta-box">
                <span class="meta-label">Billed To</span>
                <div class="meta-value">${invoice.companyName}</div>
                <div class="meta-sub">Plan: ${invoice.plan}</div>
                <div class="meta-sub">Duration: ${invoice.durationDays} Days</div>
              </div>
              <div class="meta-box text-right">
                <span class="meta-label">Payment Details</span>
                <div class="meta-value">${new Date(invoice.paymentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                <div class="meta-sub">Transaction Completed</div>
                <div class="badge">${invoice.status}</div>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight: 600; color: #0f172a;">${invoice.plan} Plan Subscription</td>
                  <td class="text-right font-bold" style="color: #0f172a;">₹${invoice.amount?.toLocaleString('en-IN') || 0}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">GST (18%)</td>
                  <td class="text-right" style="color: #64748b;">₹${invoice.gst?.toLocaleString('en-IN') || 0}</td>
                </tr>
              </tbody>
            </table>
            
            <div class="total-section">
              <div class="total-box">
                <div class="total-row">
                  <span>Subtotal</span>
                  <span>₹${invoice.amount?.toLocaleString('en-IN') || 0}</span>
                </div>
                <div class="total-row">
                  <span>Tax (18%)</span>
                  <span>₹${invoice.gst?.toLocaleString('en-IN') || 0}</span>
                </div>
                <div class="total-row final">
                  <span>Total</span>
                  <span>₹${invoice.total?.toLocaleString('en-IN') || (invoice.amount || 0)}</span>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p>This is a computer generated invoice and does not require a physical signature.</p>
              <p>Thank you for choosing FIC VMS SaaS Platform.</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    
    // Slight delay to ensure styles apply before printing
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl relative flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Invoice</h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{invoice.invoiceNo || 'INV-PENDING'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto" id="invoice-content">
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Billed To</p>
              <h3 className="font-bold text-gray-900 text-lg">{invoice.companyName}</h3>
              <p className="text-sm text-gray-500">Plan: {invoice.plan}</p>
              <p className="text-sm text-gray-500">Duration: {invoice.durationDays} Days</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Payment Date</p>
              <p className="font-semibold text-gray-900">
                {new Date(invoice.paymentDate).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'short', day: 'numeric'
                })}
              </p>
              <div className="mt-2 inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase tracking-wider">
                {invoice.status}
              </div>
            </div>
          </div>
          
          <table className="w-full text-left border-collapse mb-8">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="py-4 text-sm text-gray-900 font-medium">
                  {invoice.plan} Plan Subscription ({invoice.durationDays} Days)
                </td>
                <td className="py-4 text-sm text-gray-900 font-medium text-right">
                  ₹{invoice.amount?.toLocaleString('en-IN') || 0}
                </td>
              </tr>
              <tr>
                <td className="py-4 text-sm text-gray-500">
                  GST (18%)
                </td>
                <td className="py-4 text-sm text-gray-500 text-right">
                  ₹{invoice.gst?.toLocaleString('en-IN') || 0}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-900">
                <th className="py-4 text-lg font-bold text-gray-900">Total</th>
                <th className="py-4 text-lg font-bold text-[#1E1B6E] text-right">
                  ₹{invoice.total?.toLocaleString('en-IN') || (invoice.amount || 0)}
                </th>
              </tr>
            </tfoot>
          </table>
          
          <div className="text-center text-xs text-gray-400 mt-8">
            <p>This is a computer generated invoice and does not require a signature.</p>
            <p className="mt-1">Generated by SaaS Platform System.</p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-slate-50 shrink-0 flex justify-end">
          <button 
            onClick={handleDownload}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1E1B6E] text-white rounded-lg hover:bg-indigo-900 transition-colors font-bold text-sm shadow-md"
          >
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
