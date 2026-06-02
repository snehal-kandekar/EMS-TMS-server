async function birthdaytemplate(employeeName = "Employee") {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #4A90E2; text-align: center;">🎂 Happy Birthday!</h1>
      <p style="font-size: 16px;">Dear <strong>${employeeName}</strong>,</p>
      <p>Wishing you a fantastic birthday and a wonderful year ahead! 🎉🥳</p>
      <p style="font-size: 14px; color: #666;">
        Best regards,<br>
        <strong>CWS EMS Team</strong>
      </p>
    </div>
  `;
}

module.exports = birthdaytemplate;