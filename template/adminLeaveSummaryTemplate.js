const adminLeaveSummaryTemplate = async (monthName, year, employeesData) => {
  const logoURL = "https://res.cloudinary.com/dfvumzr0q/image/upload/v1764346150/email-assets/hzcl6heksswnumx0dpvj.jpg";

  const employeeRows = employeesData.map(emp => {
    return `
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">${emp.employeeId}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${emp.name}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${emp.designation || 'N/A'}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${emp.department || 'N/A'}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${emp.cl}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${emp.sl}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${emp.total}</td>
      </tr>
    `;
  }).join('');

  return `
    <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif;">
      <div style="width: 100%; display: flex; justify-content: center; padding-top: 50px; padding-bottom: 50px;">
        <div style="background: #ffffff; border-radius: 10px; border: 1px solid #ddd; border-bottom: 10px solid #000000; max-width: 1200px; width: 100%; padding: 30px; box-sizing: border-box;">
          
          <!-- HEADER -->
          <div style="text-align: center; margin-bottom: 25px; border-bottom: 1px solid #ccc; padding-bottom: 15px;">
            <img src="${logoURL}" alt="Logo" style="height: 80px; object-fit: contain;" />
          </div>

          <div style="text-align: left;">
            <p>Hello,</p>

            <p>
              Please find below the <strong>Monthly Leave Balance Summary Report</strong> for the month of <strong>${monthName} ${year}</strong>.
            </p>

            <p><strong>Total Employees:</strong> ${employeesData.length}</p>

            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
                <thead>
                  <tr style="background-color: #2584b0; color: white;">
                    <th style="padding: 10px; border: 1px solid #ddd;">Emp ID</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Employee Name</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Designation</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Department</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">CL Balance</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">SL Balance</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Total Balance</th>
                  </tr>
                </thead>
                <tbody>
                  ${employeeRows}
                </tbody>
              </table>
            </div>


            <p style="margin-top: 30px;">
              Best Regards,<br/>
              <strong>CWS EMS Team</strong> <br/>
                <img src="${logoURL}" alt="Logo" style="height: 40px; width: auto; max-width: 150px; object-fit: contain; margin-top: 5px;" />
            </p>
          </div>

          <footer style="margin-top: 50px; padding-top: 15px; border-top: 1px solid #ccc; font-size: 12px; color: #555; text-align: center;">
          Creative Web Solution • Registered Office: LWT, 203, C/O ITI Rd, Above PNG, Near Parihar Chowk, Aundh, Maharashtra 411007.
          </footer>
        </div>
      </div>
    </body>
  `;
};

module.exports = adminLeaveSummaryTemplate;