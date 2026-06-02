const cron = require("node-cron");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const probationReminderTemplate = require("../template/probationReminderTemplate");

const transporter = nodemailer.createTransport({
  host: "smtpout.secureserver.net",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
const sentReminders = new Map();

async function checkProbationReminders() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const employees = await User.find({
      probationCompleted: { $ne: true },
      probationEndDate: { $ne: null },
      probationStatus: { $ne: "approved" }
    });

    if (employees.length === 0) {
      console.log("No employees found with upcoming probation end dates.");
      return;
    }

    const employeesForReminder = [];

    // const employeesWithDetails = employees.map(employee => {
    //   const remainingDays = Math.ceil((employee.probationEndDate - today) / (1000 * 60 * 60 * 24));
    //   const remainingMonths = Math.ceil(remainingDays / 30);
    //   return {
    //     name: employee.name,
    //     employeeId: employee.employeeId,
    //     designation: employee.designation || "N/A",
    //     doj: employee.doj,
    //     probationEndDate: employee.probationEndDate,
    //     remainingMonths: remainingMonths,
    //     probationStatus: employee.probationStatus, 
    //   };
    // });

    for (const employee of employees) {
      const probationEndDate = new Date(employee.probationEndDate);
      probationEndDate.setHours(0, 0, 0, 0);
      
      const daysRemaining = Math.ceil((probationEndDate - today) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining === 30 || daysRemaining === 15) {
        const reminderKey = `${employee._id}_${daysRemaining}days`;
        
        if (!sentReminders.has(reminderKey)) {
          employeesForReminder.push({
            name: employee.name,
            employeeId: employee.employeeId,
            designation: employee.designation || "N/A",
            doj: employee.doj,
            probationEndDate: employee.probationEndDate,
            remainingDays: daysRemaining,
            probationStatus: employee.probationStatus,
          });
          sentReminders.set(reminderKey, today);
        }
      }
    }

    if (employeesForReminder.length === 0) {
      console.log(`No employees with exactly 15 or 30 days remaining on ${today.toDateString()}`);
      return;
    }

    const adminAndHR = await User.find({
      role: { $in: ["hr","admin"] }
    });

    if (adminAndHR.length === 0) {
      console.log("No admin/HR users found.");
      return;
    }

    const emailHtml = await probationReminderTemplate(employeesForReminder);
    
    const recipientEmails = adminAndHR.map(r => r.email);
    
    await transporter.sendMail({
      from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
      to: recipientEmails.join(", "), 
      subject: `Probation Period Reminder - ${employeesForReminder.length} employee(s) require action`,
      html: emailHtml
    });

    console.log(`Probation Reminder sent for ${employeesForReminder.length} employee(s) on ${today.toDateString()}`);
        
  } catch (error) {
    console.error("Error in probation reminder cron:", error);
  }
}

cron.schedule("10 9 * * *", () => {
  console.log("Running probation reminder check at:", new Date().toISOString());
  checkProbationReminders();
});

module.exports = { checkProbationReminders };