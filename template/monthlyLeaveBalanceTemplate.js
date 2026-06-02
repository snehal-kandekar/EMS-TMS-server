const logoURL = "https://res.cloudinary.com/dfvumzr0q/image/upload/v1764346150/email-assets/hzcl6heksswnumx0dpvj.jpg";

const monthlyLeaveBalanceTemplate = async (employeeName, monthName, year, balances) => {
  return `
    <body style="
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
    ">
      <div style="
        width: 100%;
        display: flex;
        justify-content: center;
        padding-top: 50px;
        padding-bottom: 50px;
      ">
        <div style="
          background: #ffffff;
          border-radius: 10px;
          border: 1px solid #ddd;
          max-width: 700px;
          width: 100%;
          padding: 30px;
          box-sizing: border-box;
        ">
          <!-- Header Section -->
          <div style="
            text-align: center;
            margin-bottom: 25px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 15px;
          ">
            <img 
              src="${logoURL}" 
              alt="Logo"
              style="
                height: 80px; 
                width: auto;
                object-fit: contain;
                display: block;
                margin: 0 auto;
              "
            />
          </div>

          <!-- Content Section -->
          <div style="text-align: left;">
            <p>Dear <strong>${employeeName}</strong>,</p>

            <h3 style="
              margin-top: 0;
              font-size: 20px;
              font-weight: bold;
              color: #000000;
            ">
              Monthly Leave Balance Report
            </h3>

            <p>
              Here is your leave balance summary for the month of <strong>${monthName} ${year}</strong>:
            </p>

            <div>
              <p style="margin: 8px 0;"><strong>Casual Leave:</strong> ${balances.cl} days</p>
              <p style="margin: 8px 0;"><strong>Sick Leave:</strong> ${balances.sl} days</p>
              <p style="margin: 8px 0;"><strong>Total Remaining:</strong> ${balances.total} days</p>
            </div>

            <p>
              If you have any questions or need any clarification, please feel free to reach out to your HR.
            </p>

            
            <p style="margin-top: 30px;">
              Best Regards,<br/>
              <strong>CWS EMS Team</strong><br/>
                <img src="${logoURL}" alt="Logo" style="height: 40px; width: auto; margin-top: 5px; max-width: 150px; object-fit: contain;" />
            </p>

          </div>

          <!-- Footer -->
          <footer style="
            margin-top: 50px;
            padding-top: 15px;
            border-top: 1px solid #ccc;
            font-size: 12px;
            color: #555;
            text-align: center;
          ">
          Creative Web Solution • Registered Office: LWT, 203, C/O ITI Rd, Above PNG, Near Parihar Chowk, Aundh, Maharashtra 411007.
          </footer>
        </div>
      </div>
    </body>
  `;
};

module.exports = monthlyLeaveBalanceTemplate;