const logoURL = "https://res.cloudinary.com/dfvumzr0q/image/upload/v1764346150/email-assets/hzcl6heksswnumx0dpvj.jpg";

const leaveApplicationTemplate = (employeeName, employeeId, designation, department, leaveType, dateFrom, dateTo, duration, reason, email) => {
  
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

  const getLeaveText = () => {
    if (duration === "half") return "half day leave";
    if (dateFrom === dateTo) return "one day leave";
    return "leave";
  };

  const getDateText = () => {
    if (duration === "half") return `on ${formatDate(dateFrom)} (half day)`;
    if (dateFrom === dateTo) return `on ${formatDate(dateFrom)}`;
    return `from ${formatDate(dateFrom)} to ${formatDate(dateTo)}`;
  };

  return `
  <div style="font-family: Arial, sans-serif;">
      
      <p>Dear Sir,</p>

      <p>${getGreeting()},</p>

      <p>I hope you are doing well.</p>

      <p>I am requesting ${getLeaveText()} ${getDateText()} (${leaveType}) due to ${reason}.</p>

      <p>Please grant me leave for the above-mentioned date.</p>

      <p>
        Thanks & Regards,<br/>
        ${employeeName}<br/>
        ${designation || ''} ${department ? `| ${department}` : ''}<br/>
        Employee ID: ${employeeId}<br/>
        Email: ${email || ''}
      </p>

      <div style="margin-top: 10px;">
        <img src="${logoURL}" alt="Logo" style="height: 50px;">
      </div>
    </div>
  `;
};

module.exports = leaveApplicationTemplate;