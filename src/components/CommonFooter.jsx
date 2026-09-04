import React from 'react';

const CommonFooter = () => {
  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-6 text-center text-sm text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-3">
        <img 
          src="/forge-india-logo-icon.svg" 
          alt="Forge India Connect Pvt. Ltd." 
          className="h-9 w-auto object-contain" 
        />
        <div className="flex flex-col text-left">
          <span className="font-extrabold text-[#005BAA] text-xs leading-none">FORGE INDIA CONNECT PVT. LTD.</span>
          <span className="text-[10px] font-extrabold text-[#003B73] tracking-widest uppercase mt-0.5">SHAPING FUTURE</span>
        </div>
      </div>
      <div className="text-xs text-slate-500">
        Powered by{' '}
        <a
          href="https://visitor-management-indol.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-[#1E1B6E] hover:underline"
        >
          Forge India Connect
        </a>
        {' '}• All Rights Reserved.
      </div>
    </footer>
  );
};

export default CommonFooter;
