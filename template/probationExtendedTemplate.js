const logoURL = "https://res.cloudinary.com/dfvumzr0q/image/upload/v1764346150/email-assets/hzcl6heksswnumx0dpvj.jpg";
//  const logo2 = "https://res.cloudinary.com/dqq73hjni/image/upload/v1778844121/CWS_Logo_1_mu04x7.png"

const probationExtendedTemplate = async (employeeName, newEndDate, reason) => {
  const formattedDate = newEndDate ? new Date(newEndDate).toLocaleDateString('en-US', {
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
            border-bottom: 10px solid #000000;
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
              <p>Dear ${employeeName},</p>

              <h3 style="
                margin-top: 0;
                font-size: 20px;
                font-weight: bold;
                color: #000000;
              ">
                Probation Period Extended
              </h3>

              <p>
                This is to inform you that your probation period has been extended.
              </p>

              <p>New Probation End Date: <strong>${formattedDate}</strong></p>

              <p>Reason for Extension: <strong>${reason}</strong></p>

              <p>
              If you have any questions or need any clarification, please feel free to reach out to your HR.
              </p>

              <p style="margin-top: 30px;">
                Best Regards,<br/>
                <strong>CWS EMS Team</strong>
              </p>
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

module.exports = probationExtendedTemplate;