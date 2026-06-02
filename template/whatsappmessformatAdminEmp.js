const ExcelJS = require('exceljs');

function formatWhatsAppLeaveBalanceMessage(employeeName, monthName, year, balances) {
  return `
Monthly Leave Balance Report

Dear ${employeeName},

Here is your leave balance summary for the month of ${monthName} ${year}:

Casual Leave: ${balances.cl} days
Sick Leave: ${balances.sl} days
Total Remaining: ${balances.total} days

If you have any questions, please reach out to HR.

Best Regards,
CWS EMS Team
  `;
}

async function generateExcelFile(employeesData, monthName, year) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Leave Balance Summary');

  // file title
  worksheet.mergeCells('A1:G1');
  worksheet.getCell('A1').value = `Monthly Leave Balance Summary Report - ${monthName} ${year}`;
  worksheet.getCell('A1').font = { size: 14, bold: true };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  // date
  worksheet.mergeCells('A2:G2');
  worksheet.getCell('A2').value = `Generated on: ${new Date().toLocaleString()}`;
  worksheet.getCell('A2').alignment = { horizontal: 'center' };

  worksheet.mergeCells('A3:G3');
  worksheet.getCell('A3').value = `Total Employees: ${employeesData.length}`;
  worksheet.getCell('A3').alignment = { horizontal: 'center' };

  worksheet.addRow([]); 

  //table header
  const headers = ['Employee ID', 'Employee Name', 'Designation', 'Department', 'CL Balance', 'SL Balance', 'Total Balance'];
  const headerRow = worksheet.addRow(headers);
  
  for (let i = 1; i <= headers.length; i++) {
    const cell = headerRow.getCell(i);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2584b0' }
    };
  }

  worksheet.getColumn(1).width = 15;
  worksheet.getColumn(2).width = 25;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 20;
  worksheet.getColumn(5).width = 12;
  worksheet.getColumn(6).width = 12;
  worksheet.getColumn(7).width = 15;

  employeesData.forEach(emp => {
    worksheet.addRow([
      emp.employeeId,
      emp.name,
      emp.designation,
      emp.department,
      emp.cl,
      emp.sl,
      emp.total
    ]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

function formatWhatsAppAdminSummaryMessage(monthName, year, employeesData) {
  return `
Monthly Leave Balance Summary Report ${monthName} ${year}

Total Employees: ${employeesData.length}

Excel file attached with complete details.

Please find the attached Excel file for complete report.

Best Regards,
CWS EMS Team
  `;
}

module.exports = {
  formatWhatsAppLeaveBalanceMessage,
  formatWhatsAppAdminSummaryMessage,
  generateExcelFile
};