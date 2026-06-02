const probationApprovedTemplate = async (employeeName, endDate) => {
  const formattedDate = endDate ? new Date(endDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'your probation period end date';

  try {
    const html = `
      <body style="
        margin: 0;
        padding: 0;
        background-image: url('./assets/letterbg.png');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
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
            border-bottom: 10px solid #4A90E2;
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
                src="https://res.cloudinary.com/dfvumzr0q/image/upload/v1764346150/email-assets/hzcl6heksswnumx0dpvj.jpg" 
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
              <p>Dear ${employeeName},</p>

              <h3 style="
                margin-top: 0;
                font-size: 20px;
                font-weight: bold;
                color: #4A90E2;
              ">
                Congratulations! Probation Period Approved
              </h3>

              <p>
                We are pleased to inform you that your probation period has been 
                successfully approved.
              </p>

              <p>
                You will be <strong style="color: #4A90E2;">On Role</strong> from 
                <strong>${formattedDate}</strong>.
              </p>

              <p>
                We appreciate your hard work, dedication, and contribution to the 
                organization. We look forward to your continued growth and success 
                with us.
              </p>

              <p>
                Your yearly leave benefits will be credited to your account as per 
                company policy.
              </p>

              <p style="margin-top: 30px;">
                Best Regards,<br/>
                <strong>CWS EMS Team</strong>
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
    return html;
  } catch (error) {
    console.error(`Error generating email template: ${error.message}`);
    throw new Error("Template generation failed");
  }
};

module.exports = probationApprovedTemplate;