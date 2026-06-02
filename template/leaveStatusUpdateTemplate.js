const logoURL = "https://res.cloudinary.com/dfvumzr0q/image/upload/v1764346150/email-assets/hzcl6heksswnumx0dpvj.jpg";

const leaveStatusUpdateTemplate = (employeeName, dateFrom, dateTo, status, actionReason, approverRole, approverName) => {
  
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

  const getDateText = () => {
    if (dateFrom === dateTo) return `on ${formatDate(dateFrom)}`;
    return `from ${formatDate(dateFrom)} to ${formatDate(dateTo)}`;
  };

  const getActionLabel = () => {
    if (status === "approved") return "Approval Reason";
    return "Rejection Reason";
  };

  const getReviewerLabel = () => {
    if (status === "approved") return "Approved By";
    return "Rejected By";
  };

  return `
    <div style="font-family: Arial, sans-serif;">
      
      <p>Dear ${employeeName},</p>

      <p>${getGreeting()},</p>

      <p>Your leave request ${getDateText()} has been <strong>${status === "approved" ? "Approved" : "Rejected"}</strong>.</p>

      <p><strong>Status:</strong> ${status === "approved" ? "Approved" : "Rejected"}</p>

      <p><strong>${getActionLabel()}:</strong> ${actionReason}</p>

      <p><strong>${getReviewerLabel()}:</strong> ${approverName} (${approverRole})</p>

      <p>Please ensure that all pending work is handed over properly before your leave period.</p>

      <p>
        Thanks & Regards,<br/>
        <strong>CWS EMS Team</strong><br/>
        <img src="${logoURL}" alt="Logo" style="height: 50px; margin-top: 10px;">

      </p>
    </div>
  `;
};

module.exports = leaveStatusUpdateTemplate;