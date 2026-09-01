import React from 'react';

const CommonFooter = () => {
  return (
    <footer className="border-t bg-white px-4 py-4 text-center text-sm text-gray-500">
      Powered by{' '}
      <a
        href="https://forgeindiaconnect.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-indigo-700 hover:underline"
      >
        ForgeIndiaConnect
      </a>
    </footer>
  );
};

export default CommonFooter;
