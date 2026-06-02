const logoURL = "https://res.cloudinary.com/dfvumzr0q/image/upload/v1764346150/email-assets/hzcl6heksswnumx0dpvj.jpg";

const regularizationApplicationTemplate = (employeeName, employeeId, designation, department, date, requestedCheckIn, requestedCheckOut, mode, reason, email) => {
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-');
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "N/A";
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return `
  <div style="font-family: Arial, sans-serif;">
      
      <p>Dear Sir,</p>

      <p>${getGreeting()},</p>

      <p>I hope you are doing well.</p>

      <p>I am requesting attendance regularization for ${formatDate(date)}.</p>

      <p><strong>Request Details:</strong></p>
      <ul>
        <li><strong>Date:</strong> ${formatDate(date)}</li>
        <li><strong>Requested Check-In Time:</strong> ${formatTime(requestedCheckIn)}</li>
        <li><strong>Requested Check-Out Time:</strong> ${formatTime(requestedCheckOut)}</li>
        <li><strong>Mode:</strong> ${mode || "Office"}</li>
        <li><strong>Reason:</strong> ${reason || "Not provided"}</li>
      </ul>

      <p>Please approve my regularization request for the above-mentioned date.</p>

      <p>
        Thanks & Regards,<br/>
        ${employeeName}<br/>
        ${designation || ''} ${department ? `| ${department}` : ''}<br/>
        Employee ID: ${employeeId}<br/>
        Email: ${email || ''}<br/>
        <img src="${logoURL}" alt="Logo" style="height: 50px;margin-top: 5px;">
      </p>
    </div>
  `;
};

module.exports = regularizationApplicationTemplate;

