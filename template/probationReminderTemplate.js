const probationReminderTemplate = async (employees) => {
  const logoURL = "https://res.cloudinary.com/dfvumzr0q/image/upload/v1764346150/email-assets/hzcl6heksswnumx0dpvj.jpg";

  const sortedEmployees = [...employees].sort((a, b) => new Date(a.probationEndDate) - new Date(b.probationEndDate));

  const employeeRows = sortedEmployees.map(emp => {
    const formattedEndDate = emp.probationEndDate ? new Date(emp.probationEndDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : 'N/A';

    const formattedDoj = emp.doj ? new Date(emp.doj).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : 'N/A';

    let statusText = '';
    if (emp.probationStatus === 'extended') {
      statusText = 'Extended';
    } else if (emp.probationStatus === 'pending') {
      statusText = 'Pending';
    }

    return `
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">${emp.name}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${statusText}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${emp.employeeId}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${emp.designation || 'N/A'}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${formattedDoj}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${formattedEndDate}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${emp.remainingDays} days</td>
      </tr>
    `;
  }).join('');

  return `
    <body style="margin: 0; 
          padding: 0; 
          font-family: Arial, 
          Helvetica, sans-serif;"
    >
      <div style="width: 100%; 
          display: flex; 
          justify-content: center; 
          padding-top: 50px; 
          padding-bottom: 50px;"
      >
        <div style="background: #ffffff; 
              border-radius: 10px; 
              border: 1px solid #ddd; 
              border-bottom: 10px solid #000000; 
              max-width: 1200px; 
              width: 100%; 
              padding: 30px; 
              box-sizing: border-box;"
        >
          
          <!-- HEADER -->
          <div style="text-align: 
              center; margin-bottom: 25px; 
              border-bottom: 1px solid #ccc; 
              padding-bottom: 15px;">
            <img src="https://res.cloudinary.com/dfvumzr0q/image/upload/v1764346150/email-assets/hzcl6heksswnumx0dpvj.jpg" alt="Logo" style="height: 80px; object-fit: contain;" />
          </div>

          <div style="text-align: left;">
            <p>Dear HR/Admin Team,</p>

            <p>
            This is to notify you that the following <strong>${employees.length} employee(s)</strong> have their probation period ending within the next month:
            </p>

            <div>
              <strong>Summary:</strong><br/>
              ${employees.filter(e => e.remainingDays === 30).length} employee(s) have 30 days remaining<br/>
              ${employees.filter(e => e.remainingDays === 15).length} employee(s) have 15 days remaining 
            </div>

            <div style="overflow-x: auto;">
              <table style="width: 100%; 
                    border-collapse: collapse; 
                    margin: 20px 0; 
                    font-size: 14px;"
              >
                <thead>
                  <tr style="background-color: #2584b0; color: white;">
                    <th style="padding: 10px; border: 1px solid #ddd;">Employee Name</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Status</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Employee ID</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Designation</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Date of Joining</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Probation End Date</th>
                    <th style="padding: 10px; border: 1px solid #ddd;">Days Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  ${employeeRows}
                </tbody>
              </table>
            </div>

            <p style="margin-top: 20px;">
              <strong>Action Required:</strong> Please review the performance of these employees and take necessary action regarding probation completion or extension.
            </p>

            <p style="margin-top: 30px;">
              Best Regards,<br/>
              <strong>CWS EMS Team</strong>
              <div style="margin-top: 5px;">
                <img 
                  src="${logoURL}" 
                  alt="Logo"
                  style="
                    height: 40px;
                    width: auto;
                    max-width: 150px;
                    object-fit: contain;
                  "
                />
              </div>
            </p>
          </div>

          <footer style="margin-top: 50px; 
                  padding-top: 15px; 
                  border-top: 1px solid #ccc; 
                  font-size: 12px; 
                  color: #555; 
                  text-align: center;"
          >
          Creative Web Solution • Registered Office: LWT, 203, C/O ITI Rd, Above PNG, Near Parihar Chowk, Aundh, Maharashtra 411007.
          </footer>
        </div>
      </div>
    </body>
  `;
};

module.exports = probationReminderTemplate;