const logoURL = "https://res.cloudinary.com/dfvumzr0q/image/upload/v1764346150/email-assets/hzcl6heksswnumx0dpvj.jpg";

const regularizationStatusUpdateTemplate = (employeeName, date, requestedCheckIn, requestedCheckOut, status, actionReason, approverRole, approverName) => {
  
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

  const formatTime = (time) => {
    if (!time) return "N/A";
    const date = new Date(time);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getActionLabel = () => {
    if (status === "Approved") return "Approval Reason";
    return "Rejection Reason";
  };

  const getReviewerLabel = () => {
    if (status === "Approved") return "Approved By";
    return "Rejected By";
  };

  return `
    <div style="font-family: Arial, sans-serif;">
      
      <p>Dear ${employeeName},</p>

      <p>${getGreeting()},</p>

      <p>Your attendance regularization request for <strong>${formatDate(date)}</strong> has been <strong style="color: ${status}">${status}</strong>.</p>

      <p><strong>Requested Check-in:</strong> ${formatTime(requestedCheckIn)}</p>

      <p><strong>Requested Check-out:</strong> ${formatTime(requestedCheckOut)}</p>

      <p><strong>Status:</strong> <span style="color: ${status}; font-weight: bold;">${status}</span></p>

      <p><strong>${getActionLabel()}:</strong> ${actionReason || 'No reason provided'}</p>

      <p><strong>${getReviewerLabel()}:</strong> ${approverName} (${approverRole})</p>

      <p>Please ensure accurate attendance going forward. If you have any questions, please contact HR.</p>

      <p>
        Thanks & Regards,<br/>
        <strong>CWS EMS Team</strong><br/>
        <img src="${logoURL}" alt="Logo" style="height: 50px; margin-top: 5px;">

      </p>

    </div>
  `;
};

module.exports = regularizationStatusUpdateTemplate;