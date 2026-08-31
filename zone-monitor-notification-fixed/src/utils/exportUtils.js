/**
 * Export Utility (Phase 16)
 * Converts JSON data to CSV and triggers a download in the browser.
 */

export const exportToCSV = (data, filename = 'export.csv') => {
  if (!data || !data.length) {
    alert("No data available to export.");
    return;
  }

  // Get headers from the first object
  const headers = Object.keys(data[0]);
  
  // Format rows
  const csvRows = [];
  
  // Add header row
  csvRows.push(headers.map(header => `"${header}"`).join(','));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      // Escape quotes and wrap in quotes to handle commas within values
      const escapedVal = (val === null || val === undefined) ? '' : String(val).replace(/"/g, '""');
      return `"${escapedVal}"`;
    });
    csvRows.push(values.join(','));
  }
  
  // Create Blob and download link
  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
