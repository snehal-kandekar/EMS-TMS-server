const express = require("express");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const multer = require("multer");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const User = require("./models/User"); // Your Mongoose User model
const connectDB = require("./db");
const Attendance = require("./models/AttendanceSchema");
const path = require("path");
const fs = require("fs");
const setPasswordTemplate = require("./template/setPasswordTemplate");
const rePasswordTemplate = require("./template/resetPasswordTemplate");
const probationCompletedTemplate = require("./template/probationCompletedTemplate");
const leaveApplicationTemplate = require("./template/leaveApplicationTemplate");
const leaveStatusUpdateTemplate = require('./template/leaveStatusUpdateTemplate');
const probationExtendedTemplate = require("./template/probationExtendedTemplate");
const probationApprovedTemplate = require("./template/probationApprovedTemplate");
const adminProbationExtendedTemplate = require("./template/adminProbationExtendedTemplate");
const adminProbationApprovedTemplate = require("./template/adminProbationApprovedTemplate");
const regularizationApplicationTemplate = require("./template/regularizationApplicationTemplate");
const regularizationStatusUpdateTemplate = require("./template/regularizationStatusUpdateTemplate");
const projectRoutes = require("./routes/projectRoutes");
const Task = require("./models/TaskSchema");
const Status = require("./models/StatusSchema");
const taskTypes = require("./routes/taskTypeRoutes");
const CustomStatus = require("./models/StatusSchema");
const TaskNotification = require("./models/TaskNotificationSchema");
const teamRoutes = require("./routes/teamRoutes");
const Project = require("./models/ProjectSchema");
const Team = require("./models/TeamSchema");
const galleryRoutes = require("./routes/galleryRoutes");
const Break = require("./models/Break");
const birthdayTemplate = require("./template/birthdaytemplate");
const birthdayAnnouncementTemplate = require("./template/birthdayAnnouncementTemplate");

const anniversaryTemplate = require("./template/anniversaryTemplate");
const anniversaryAnnouncementTemplate = require("./template/anniversaryAnnouncementTemplate");
const Feedback = require("./models/FeedbackSchema");
const Resignation = require("./models/ResignationSchema");
const ticketRoutes = require("./routes/ticketRoutes");
const { getValidWorkingDays } = require("./services/dateUtils");
const pollRoutes = require("./routes/pollRoutes");
const Performance = require("./models/performanceSchema"); //added by jayshree
const PolicyAcknowledgement = require("./models/policyAcknowledgement");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const Interview = require("./models/InterviewSchema");
const resumeUpload = require("./authMiddleware/resumeUpload");
require("./cron/interviewStatusCron");
require("./cron/probationReminderCron");
require("./cron/monthlyLeaveBalanceCron")
dotenv.config();

const app = express();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET,
});

// ADD THIS BLOCK HERE for the 304 cache clearing
app.use((req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Surrogate-Control": "no-store"
  });
  next();
});

/* ================= FILE UPLOAD ================= */
// const uploadPath = path.join(__dirname, "uploads");
// app.use("/uploads", express.static(uploadPath));
// app.use("/uploads", express.static("uploads"));



const allowedOrigins = [
  "https://www.creativewebsolution.life",
  "https://ems-tms-client.vercel.app",
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  // Important: respond to OPTIONS directly
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/teams", teamRoutes);
app.use("/api/polls", pollRoutes);
// Serve uploads folder statically
//app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/projects", projectRoutes);
app.use("/api/task-types", require("./routes/taskTypeRoutes"));
app.use("/announcements", require("./routes/announcementRoutes"));
app.use("/api/polls", require("./routes/pollRoutes"));
app.use("/api/gallery", galleryRoutes);
app.use("/api/jobs", require("./routes/jobRoutes"));
app.use("/api/apply", require("./routes/applicationRoutes"));
app.use("/api/tasklogs", require("./routes/taskWorkLogRoutes"));
app.use("/api/tickets", ticketRoutes);
//db connection
connectDB();

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "hygggftr4NFDXXgfhgfDFGFafggfhbjhhddfdcvhyttrdfccggjggmkiu8765ghf";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

app.get("/", (req, res) => {
  res.send("API is running...");
});
app.get("/", (req, res) => {
  res.send("API is running...");
});
app.get("/attendance/manager-late-checkins", async (req, res) => {

  try {

    const { from, to, name, managerId } = req.query;

    const query = {};

    // Date Filter
    if (from || to) {

      query.checkIn = {};

      if (from) {

        const startDate = new Date(from);

        startDate.setHours(0, 0, 0, 0);

        query.checkIn.$gte = startDate;
      }

      if (to) {

        const endDate = new Date(to);

        endDate.setHours(23, 59, 59, 999);

        query.checkIn.$lte = endDate;
      }
    }

   const attendance = await Attendance.find(query)
  .populate("employee");

    let filteredAttendance = attendance;

    // Manager Employees Filter
    if (managerId) {

      filteredAttendance = filteredAttendance.filter(
        (record) =>
          record.employee &&
          record.employee.reportingManager &&
       record.employee.reportingManager?._id?.toString() ===
managerId
      );
    }

    // Late Check-In + Name Filter
    const filtered = filteredAttendance.filter((record) => {

      if (!record.checkIn) return false;

      const checkIn = new Date(record.checkIn);

      const isLate =
        checkIn.getHours() > 10 ||
        (
          checkIn.getHours() === 10 &&
          checkIn.getMinutes() > 0
        );

      const employeeName =
        record.employee?.name?.toLowerCase() || "";

      const matchesName =
        !name ||
        employeeName.includes(name.toLowerCase());

      return isLate && matchesName;
    });

    const response = filtered.map((record) => ({
      _id: record._id,
      name: record.employee?.name || "-",
      employeeId:
        record.employee?.employeeId || "-",
      designation:
        record.employee?.designation || "-",
      checkInTime: record.checkIn,
      checkOutTime: record.checkOut,
      mode: record.mode || "-",
    }));

    res.status(200).json(response);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      message: "Failed to fetch manager late check-ins",
      error: err.message,
    });
  }
});

// app.get("/attendance/late-checkins", async (req, res) => {
//   try {

//     const { from, to, name, teamLeaderId } = req.query;

//     const query = {};

//     // Date Filter
// if (from || to) {

//   query.checkIn = {};

//   if (from) {

//     const startDate = new Date(from);

//     startDate.setHours(0, 0, 0, 0);

//     query.checkIn.$gte = startDate;
//   }

//   if (to) {

//     const endDate = new Date(to);

//     endDate.setHours(23, 59, 59, 999);

//     query.checkIn.$lte = endDate;
//   }
// }

//     const attendance = await Attendance.find(query)
//       .populate("employee");

//     let filteredAttendance = attendance;

//     // Team Leader Filter
// if (teamLeaderId) {

// const teams = await Team.find({
//   teamLead: {
//     $in: [teamLeaderId],
//   },
// });

// const teamEmployeeIds = teams.flatMap(
//   (team) => [
//     ...(team.members || []),
//     ...(team.assignToProject || []),
//   ]
// );

//   filteredAttendance = filteredAttendance.filter(
//     (record) =>
//       record.employee &&
//       teamEmployeeIds.some(
//         (empId) =>
//           empId.toString() ===
//           record.employee._id.toString()
//       )
//   );
// }

//     // Late Check-In + Name Filter
//     const filtered = filteredAttendance.filter((record) => {

//       if (!record.checkIn) return false;

//       const checkIn = new Date(record.checkIn);

//       const isLate =
//     checkIn.getHours() > 9 ||
// (
//   checkIn.getHours() === 9 &&
//   checkIn.getMinutes() > 10
// )

//       const employeeName =
//         record.employee?.name?.toLowerCase() || "";

//       const matchesName =
//         !name ||
//         employeeName.includes(name.toLowerCase());

//       return isLate && matchesName;
//     });

//     // Response
//     const response = filtered.map((record) => ({
//       _id: record._id,
//       name: record.employee?.name || "-",
//       employeeId:
//         record.employee?.employeeId || "-",
//       designation:
//         record.employee?.designation || "-",
//       checkInTime: record.checkIn,
//       checkOutTime: record.checkOut,
//       mode: record.mode || "-",
//     }));

//     res.status(200).json(response);

//   } catch (err) {

//   console.log(err);

//   res.status(500).json({
//     message: "Failed to fetch late check-ins",
//     error: err.message,
//   });
// }
// });
app.get("/attendance/late-checkins", async (req, res) => {
  try {

    const { from, to, name, teamLeaderId } = req.query;

    const query = {};

    // Date Filter
if (from || to) {

  query.checkIn = {};

  if (from) {

    const startDate = new Date(from);

    startDate.setHours(0, 0, 0, 0);

    query.checkIn.$gte = startDate;
  }

  if (to) {

    const endDate = new Date(to);

    endDate.setHours(23, 59, 59, 999);

    query.checkIn.$lte = endDate;
  }
}

    // const attendance = await Attendance.find(query)
    //   .populate("employee");
    const attendance = await Attendance.find(query)
  .populate("employee", "employeeId name designation");
   

    let filteredAttendance = attendance;

    // Team Leader Filter
if (teamLeaderId) {

const teams = await Team.find({
  teamLead: {
    $in: [teamLeaderId],
  },
});

const teamEmployeeIds = teams.flatMap(
  (team) => [
    ...(team.members || []),
    ...(team.assignToProject || []),
  ]
);

  filteredAttendance = filteredAttendance.filter(
    (record) =>
      record.employee &&
      teamEmployeeIds.some(
        (empId) =>
          empId.toString() ===
          record.employee._id.toString()
      )
  );
}

    // Late Check-In + Name Filter
    const filtered = filteredAttendance.filter((record) => {

      if (!record.checkIn) return false;

      const checkIn = new Date(record.checkIn);

      const isLate =
    checkIn.getHours() > 9 ||
(
  checkIn.getHours() === 9 &&
  checkIn.getMinutes() > 10
)

      const employeeName =
        record.employee?.name?.toLowerCase() || "";

      const matchesName =
        !name ||
        employeeName.includes(name.toLowerCase());

      return isLate && matchesName;
    });

    // Response
  //   const response = filtered.map((record) => ({
  //     _id: record._id,
  //     name: record.employee?.name || "-",
  //     employeeId:
  //       record.employee?.employeeId || "-",
  //     designation:
  //       record.employee?.designation || "-",
  //     checkInTime: record.checkIn,
  //     checkOutTime: record.checkOut,
  //     mode: record.mode || "-",
  //       // ✅ Add this
  // lateCheckInCount: record.lateCheckInCount || 0,
  //   }));
//   const checkIn = new Date(record.checkIn);

// const isLate =
//   checkIn.getHours() > 9 ||
//   (checkIn.getHours() === 9 &&
//     checkIn.getMinutes() > 10);

// const response = filtered.map((record) => ({
//   _id: record._id,
//   name: record.employee?.name || "-",
//   employeeId: record.employee?.employeeId || "-",
//   designation: record.employee?.designation || "-",
//   checkInTime: record.checkIn,
//   checkOutTime: record.checkOut,
//   mode: record.mode || "-",

//   lateCheckInCount: record.lateCheckInCount || 0,

//   // ✅ ADD THIS
//   lateCheckIn: isLate,
// }));

const response = filtered.map((record) => {

  const checkIn = new Date(record.checkIn);

  const isLate =
    checkIn.getHours() > 9 ||
    (checkIn.getHours() === 9 &&
      checkIn.getMinutes() > 10);

  return {
    _id: record._id,
     employeeId: record.employee?.employeeId || "-",
    name: record.employee?.name || "-",
   
    designation: record.employee?.designation || "-",
    checkInTime: record.checkIn,
    checkOutTime: record.checkOut,
    mode: record.mode || "-",

    lateCheckInCount: record.lateCheckInCount || 0,

    // ✅ Late flag
    lateCheckIn: isLate,
  };
});
console.log(response);
    res.status(200).json(response);

  } catch (err) {

  console.log(err);

  res.status(500).json({
    message: "Failed to fetch late check-ins",
    error: err.message,
  });
}
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let resourceType = "image";

    // ✅ Allow PDF & Excel as RAW
    if (
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      resourceType = "raw";
    }

    return {
      folder: "uploads",
      resource_type: resourceType,
      public_id: `${Date.now()}-${file.originalname}`,
    };
  },
});

const upload = multer({ storage });
//SNehal COde

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: "smtpout.secureserver.net",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER, // must be a valid GoDaddy email
    pass: process.env.EMAIL_PASS, // password
  },
});

// Admin authentication middleware
const adminAuthenticate = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ message: "Authorization header missing" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res
        .status(401)
        .json({ message: "Token missing in Authorization header" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.error("JWT Verify Error:", err.message);
        return res.status(403).json({ message: "Invalid or expired token" });
      }

      // Check role
      if (user.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admins only." });
      }

      req.user = user; // store user info in request
      next();
    });
  } catch (err) {
    console.error("Admin Auth Middleware Error:", err.message);
    res
      .status(500)
      .json({ message: "Internal server error in authentication" });
  }
};

//userAuthenticate
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ message: "Authorization header missing" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res
        .status(401)
        .json({ message: "Token missing in Authorization header" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.error("JWT Verify Error:", err.message);
        return res.status(403).json({ message: "Invalid/Expired token" });
      }
      req.user = user;
      next();
    });
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    res.status(500).json({ message: "Internal server error in authenticate" });
  }
};

// Routes
app.get("/", (req, res) => {
  res.send("API is running...");
});

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// Admin Add Employee
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
//register Employee
app.post(
  "/admin/add-employee",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "panCardPdf", maxCount: 1 },
    { name: "aadharCardPdf", maxCount: 1 },
    { name: "appointmentLetter", maxCount: 1 },
    { name: "passbookPdf", maxCount: 1 },
    { name: "certificatePdf", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      let {
        name,
        email,
        contact,
        employeeId,
        gender,
        dob,
        maritalStatus,
        designation,
        department,
        salary,
        salaryType,
        role,
        doj,
        currentAddress,
        permanentAddress,
        bankDetails,
        pfNumber,
        uanNumber,
      } = req.body;
      console.log("emp detaiols", req.body);
      if (!email) return res.status(400).json({ error: "Email is required" });

      // Fix maritalStatus capitalization
      if (maritalStatus) {
        maritalStatus =
          maritalStatus.charAt(0).toUpperCase() +
          maritalStatus.slice(1).toLowerCase();
      }

      // Prevent duplicates
      const exists = await User.findOne({ $or: [{ email }, { employeeId }] });
      if (exists)
        return res
          .status(400)
          .json({ error: "Email or Employee ID already exists" });

      // Parse nested objects safely
      let currentAddr = {};
      let permanentAddr = {};
      let bankDtls = {};
      try {
        currentAddr = JSON.parse(currentAddress);
      } catch {}
      try {
        permanentAddr = JSON.parse(permanentAddress);
      } catch {}
      try {
        bankDtls = JSON.parse(bankDetails);
      } catch {}

 
          probationMonths = parseInt(req.body.probationMonths) || 6; ////new change probation period step 1 
      let probationEndDate = null;
      console.log("Probation Months received:", probationMonths); // ADD THIS
console.log("DOJ received:", doj);
console.log("Calculated probationEndDate:", probationEndDate);
      

      const dojDate = new Date(doj);
      const endDate = new Date(dojDate);

      // Fix auto-adjust overflow by resetting to 1
      endDate.setDate(1);

      // Now add probation months
      endDate.setMonth(dojDate.getMonth() + probationMonths);

      // Restore original date safely
      const day = dojDate.getDate();
      const lastDay = new Date(
        endDate.getFullYear(),
        endDate.getMonth() + 1,
        0,
      ).getDate();
      endDate.setDate(Math.min(day, lastDay));

      probationEndDate = endDate;

      // Create new employee
      const newEmployee = new User({
        name,
        email,
        contact,
        employeeId,
        gender,
        dob,
        maritalStatus,
        designation,
        department,
        salary,
        salaryType,
        role,
        doj,
        pfNumber,
        uanNumber,
       probationMonths: probationMonths, /////new change step 2 probation// optional, already in schema
        probationEndDate: probationEndDate,// <-- AUTO CALCULATED
        password: "",
        // image: req.files?.image?.[0]?.filename || null,
        // panCardPdf: req.files?.panCardPdf?.[0]?.filename || null,
        // aadharCardPdf: req.files?.aadharCardPdf?.[0]?.filename || null,
        // appointmentLetter: req.files?.appointmentLetter?.[0]?.filename || null,
        // bankDetails: { ...bankDtls, passbookPdf: req.files?.passbookPdf?.[0]?.filename || null },
        image: req.files?.image?.[0]?.filename || null,
        panCardPdf: req.files?.panCardPdf?.[0]?.filename || null,
        aadharCardPdf: req.files?.aadharCardPdf?.[0]?.filename || null,
        appointmentLetter: req.files?.appointmentLetter?.[0]?.filename || null,
        certificatePdf: req.files?.certificatePdf?.[0]?.filename || null,

        bankDetails: {
          ...bankDtls,
          passbookPdf: req.files?.passbookPdf?.[0]?.filename || null,
        },

        currentAddress: currentAddr,
        permanentAddress: permanentAddr,
      });

      console.log("DOJ received:", doj);
      console.log("Calculated probationEndDate:", probationEndDate);
      console.log("Saving Employee...");

      await newEmployee.save();

      // Generate verification token
      const token = jwt.sign({ _id: newEmployee._id }, JWT_SECRET, {
        expiresIn: "1d",
      });
      newEmployee.verifyToken = token;
      await newEmployee.save();

      const verifyLink = `https://ems-tms-client.vercel.app/employee/verify/${
        newEmployee._id
      }/${encodeURIComponent(token)}`;

      const setPasswordHtml = await setPasswordTemplate(verifyLink);
      // Send email safely
      try {
        await transporter.sendMail({
          from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "Verify your email - set your password",
          html: setPasswordHtml,
        });
      } catch (err) {
        console.error("Email sending failed:", err.message);
      }

      res.json({
        message: "Employee added successfully & verification link sent!",
      });
    } catch (err) {
      console.error("Add employee error:", err);
      res.status(500).json({ error: "Server Error" });
    }
  },
);
// -----------------------prbation peroid extension-----------------------//
////fetch employee whose probation period about end step 5
app.get("/admin/probation-ending-soon", async (req, res) => {
  try {
    const today = new Date();
    const oneMonthLater = new Date();
    oneMonthLater.setMonth(today.getMonth() + 1);

    const employees = await User.find({
      probationCompleted: { $ne: true },
      probationEndDate: { $gte: today, $lte: oneMonthLater }
    }).select("name department designation employeeId doj probationEndDate probationStatus");

    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// probation reminder 
app.get("/admin/probation-reminder", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "hr") {
      return res.status(403).json({ success: false });
    }

    const today = new Date();
    const oneMonthLater = new Date();
    oneMonthLater.setMonth(today.getMonth() + 1);

    const employees = await User.find({
      probationCompleted: { $ne: true },
      probationEndDate: { $gte: today, $lte: oneMonthLater },
      probationStatus: { $ne: "approved" }
    }).select("name department designation employeeId doj probationEndDate probationStatus");

    res.json({ success: true, employees });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/////////probation period extension step 6
app.post("/admin/probation/extend/:employeeId", authenticate,async (req, res) => {
  try {
    const { newEndDate, reason } = req.body;  

    if (!newEndDate) {
      return res.status(400).json({ error: "New end date is required" });
    }
    
    if (!reason || reason.trim() === "") {
      return res.status(400).json({ error: "Reason is required" });
    }

    const actionBy = req.user?._id?.toString();

    const emp = await User.findById(req.params.employeeId);
    if (!emp) return res.status(404).json({ error: "Employee not found" });

  const parsedDate = new Date(newEndDate);  


  emp.probationEndDate = parsedDate;
  emp.probationExtendedDate = parsedDate;
  emp.probationStatus = "extended";  
  emp.probationExtensionReason = reason;  
  emp.probationReminderSent = false;
  
  await emp.save();

  const formattedDate = parsedDate.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric"
  });

  //send mail 
  try {
    const emailHtml = await probationExtendedTemplate(emp.name, parsedDate, reason);
    await transporter.sendMail({
      from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
      to: emp.email,
      subject: "Probation Period Extended",
      html: emailHtml
    });
  } catch (emailErr) {
    console.error("Email sending failed:", emailErr.message);
  }

  try {
    const adminRoles = ["hr","admin"];
    const admins = await User.find({ role: { $in: adminRoles } });
    
    const adminEmailHtml = await adminProbationExtendedTemplate(
      emp.name, 
      emp.employeeId, 
      emp.department, 
      emp.designation, 
      parsedDate, 
      reason, 
      'Admin'
    );
    
    for (const admin of admins) {
      await transporter.sendMail({
        from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
        to: admin.email,
        subject: `Probation Extended - ${emp.name}`,
        html: adminEmailHtml
      });
    }
    console.log(`Probation extension notification sent to ${admins.length} admins/HR`);
  } catch (adminEmailErr) {
    console.error("Admin email failed:", adminEmailErr.message);
  }

    // Notify all admins
    const adminRoles = ["admin", "ceo", "coo", "md", "hr"];
    const admins = await User.find({ role: { $in: adminRoles } });
    for (const admin of admins)  {
      if (admin._id.toString() === actionBy) continue;
      await Notification.create({
        user: admin._id,
        type: "Probation",
        message: `${emp.name}'s probation period has been extended. New end date: ${formattedDate}.Reason: ${reason}`,
        createdAt: new Date(),
        triggeredByRole: "ADMIN",
      });
    }

    if (emp.reportingManager) {
      await Notification.create({
        user: emp.reportingManager,
        type: "Probation",
        message: `Your team member ${emp.name}'s probation period has been extended. New end date: ${formattedDate}. Reason: ${reason}`,
        createdAt: new Date(),
        triggeredByRole: "ADMIN",
      });
    }

    // Notify Team Leaders
    const teams = await Team.find({
      assignToProject: { $in: [emp._id] }
    }).populate("teamLead", "_id name role");

    const notifiedTLs = new Set();
    for (const team of teams) {
      if (team.teamLead && team.teamLead.length) {
        for (const tl of team.teamLead) {
          if (tl && tl.role === "Team_Leader" && !notifiedTLs.has(tl._id.toString())) {
            notifiedTLs.add(tl._id.toString());
            await Notification.create({
              user: tl._id,
              type: "Probation",
              message: `Your team member ${emp.name}'s probation period has been extended. New end date: ${formattedDate}. Reason: ${reason}`,
              createdAt: new Date(),
              triggeredByRole: "ADMIN",
            });
          }
        }
      }
    }
    

    // Notify the employee
    await Notification.create({
      user: emp._id,
      type: "Probation",
      message: `Your probation period has been extended. New end date: ${formattedDate}.Reason: ${reason}`,
      createdAt: new Date(),
      triggeredByRole: "ADMIN",
    });



    res.json({ message: "Probation extended.", newEndDate: parsedDate, status: "extended"  });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


/////probation period approval
app.post("/admin/probation/approve/:employeeId",authenticate, async (req, res) => {
  try {
    const actionBy = req.user?._id?.toString();

    const emp = await User.findById(req.params.employeeId);
    if (!emp) return res.status(404).json({ error: "Employee not found" });

    //  Just mark as approved, don't complete yet
    // Employee will go On Role on their probationEndDate naturally
    emp.probationStatus = "approved";
    await emp.save();

    const formattedEndDate = new Date(emp.probationEndDate).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric"
    });


    //send email
    try {
      const emailHtml = await probationApprovedTemplate(emp.name, formattedEndDate);
      await transporter.sendMail({
        from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
        to: emp.email,
        subject: "Probation Period Approved - On Role Confirmation",
        html: emailHtml
      });
      console.log(`Probation approval email sent to ${emp.email}`);
    } catch (emailErr) {
      console.error("Email sending failed:", emailErr.message);
    }

    try {
      const adminRoles = [ "admin","hr"];
      const admins = await User.find({ role: { $in: adminRoles } });
      
      const adminEmailHtml = await adminProbationApprovedTemplate(
        emp.name, 
        emp.employeeId, 
        emp.department, 
        emp.designation, 
        emp.probationEndDate, 
      );
      
      for (const admin of admins) {
        await transporter.sendMail({
          from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
          to: admin.email,
          subject: `Probation Approved - ${emp.name} is now On-Role`,
          html: adminEmailHtml
        });
      }
      console.log(`Probation approval notification sent to ${admins.length} admins/HR`);
    } catch (adminEmailErr) {
      console.error("Admin email failed:", adminEmailErr.message);
    }
        
    const adminRoles = ["admin", "ceo", "coo", "md", "hr"];
    const admins = await User.find({ role: { $in: adminRoles } });
    for (const admin of admins) {
      if (admin._id.toString() === actionBy) continue;
      await Notification.create({
        user: admin._id,
        type: "Probation",
        message: `${emp.name}'s probation has been approved. They will be On Role from ${formattedEndDate}.`,
        createdAt: new Date(),
        triggeredByRole: "ADMIN",
      });
    }

    //notify manager 
    if (emp.reportingManager) {
      await Notification.create({
        user: emp.reportingManager,
        type: "Probation",
        message: `Your team member ${emp.name}'s probation has been approved. They will be On Role from ${formattedEndDate}.`,
        createdAt: new Date(),
        triggeredByRole: "ADMIN",
      });
    }

    //notify tl
    const teams = await Team.find({
      assignToProject: { $in: [emp._id] }
    }).populate("teamLead", "_id name role");

    const notifiedTLs = new Set();
    for (const team of teams) {
      if (team.teamLead && team.teamLead.length) {
        for (const tl of team.teamLead) {
          if (tl && tl.role === "Team_Leader" && !notifiedTLs.has(tl._id.toString())) {
            notifiedTLs.add(tl._id.toString());
            await Notification.create({
              user: tl._id,
              type: "Probation",
              message: `Your team member ${emp.name}'s probation has been approved. They will be On Role from ${formattedEndDate}.`,
              createdAt: new Date(),
              triggeredByRole: "ADMIN",
            });
          }
        }
      }
    }
   
    await Notification.create({
      user: emp._id,
      type: "Probation",
      message: `Your probation period has been approved. You will be On Role from ${formattedEndDate}.`,
      createdAt: new Date(),
      triggeredByRole: "ADMIN",
    });




    res.json({ message: "Probation approved successfully." });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

//verify email by using id
app.get("/employee/verify/:id/:token", async (req, res) => {
  try {
    const { id, token } = req.params;
    const employee = await User.findById(id);
    if (!employee || employee.verifyToken !== token)
      return res.status(400).json({ error: "Invalid or expired link" });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

//once email verify then employee can set the passwords
app.post("/employee/set-password", async (req, res) => {
  try {
    const { id, token, password } = req.body;

    if (!id || !token || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const employee = await User.findById(id);
    if (!employee || employee.verifyToken !== token) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // 🔑 Hash password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    employee.password = hashedPassword;
    employee.verifyToken = null;
    employee.isVerified = true;

    await employee.save();
    res.json({ message: "Password set successfully!" });
  } catch (err) {
    console.error("Set password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

//-------------end registration employee code------------
//-------------------add helper for automatic add leave balance if employee completed probation peroid
async function autoGrantLeaveIfProbationCompleted(user) {
  const today = new Date();

  if (user.probationCompleted === true) return; // already credited
  // if (!user.probationEndDate) return; // no probation date set
  let probationEndDate = user.probationEndDate;

  if (!probationEndDate) {
    if (!user.doj || !user.probationMonths) return;

    probationEndDate = new Date(user.doj);
    probationEndDate.setMonth(
      probationEndDate.getMonth() + user.probationMonths,
    );

    // save computed probation end date
    user.probationEndDate = probationEndDate;
    await user.save();
  }
  if (today < user.probationEndDate) return; // still in probation

  // default yearly leave
  const YEARLY_CL = 17;
  const YEARLY_SL = 4;

  // credit leave
  user.casualLeaveBalance += YEARLY_CL;
  user.sickLeaveBalance += YEARLY_SL;

  user.probationCompleted = true;
  user.lastLeaveUpdate = today;

  await user.save();
  console.log(`🎉 Auto leave credited for ${user.name}`);
  const probationHtml = await probationCompletedTemplate(user.name, user.probationEndDate); //rutuja 07-04-26

  // -----------------------------------------------------
  // 1️⃣ SEND EMAIL TO EMPLOYEE
  // -----------------------------------------------------
  try {
    await transporter.sendMail({
      from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "🎉 Probation Period Completed – Leave Credited",
      html: probationHtml,
      //       text: `Dear ${user.name},

      // Congratulations! You have successfully completed your probation period.

      // Your yearly leave balance has now been added:
      // • Casual Leave: +15
      // • Sick Leave: +6

      // You can check your updated leave balance on your dashboard.

      // Best Regards,
      // CWS EMS Team`
    });
    console.log("📧 Probation completion email sent!");
  } catch (err) {
    console.error("Email sending failed:", err);
  }

  // -----------------------------------------------------
  // 2️⃣ SEND NOTIFICATION TO EMPLOYEE
  // -----------------------------------------------------
  // await Notification.create({
  //   userId: user._id,
  //   message:
  //     "🎉 Congratulations! You have completed your probation period and yearly leave has been credited.",
  //   createdAt: new Date(),
  // });
  await Notification.create({
    user: user._id,
    type: "Probation",
    message:
      "🎉 Congratulations! You have completed your probation period and yearly leave has been credited.",
    createdAt: new Date(),
    triggeredByRole: "HR",
  });
  // -----------------------------------------------------
  // 3️⃣ SEND NOTIFICATION TO ADMIN
  // -----------------------------------------------------
  const admins = await User.find({ role: "admin" });

  for (const admin of admins) {
    await Notification.create({
      user: admin._id,
      type: "Probation",
      message: `${user.name} has completed probation and leave balance is credited.`,
      createdAt: new Date(),
      triggeredByRole: "EMPLOYEE",
    });
  }

  // -----------------------------------------------------
  // 4️⃣ SEND NOTIFICATION TO MANAGER (if assigned)
  // -----------------------------------------------------
  if (user.managerId) {
    await Notification.create({
      user: user.managerId,
      type: "Probation",
      message: `Your team member ${user.name} has completed probation and leave is credited.`,
      createdAt: new Date(),
      triggeredByRole: "EMPLOYEE",
    });
  }
}

//-------------------end helper for automatic add leave balance if employee completed probation peroid

//login code
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(req.body);
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (user.isDeleted) {
      return res
        .status(403)
        .json({ message: "Your account has been deactivated" });
    }

    // console.log("👉 Stored password (DB):", user.password);
    // const isMatch = await bcrypt.compare(password, user.password);
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("👉 bcrypt result:", isMatch);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credential" });
    }

    console.log("isMatch", isMatch);

    // -------------------------------------------------------
    // ⭐ AUTO LEAVE CREDIT SECTION
    // -------------------------------------------------------
    await autoGrantLeaveIfProbationCompleted(user);
    // -------------------------------------------------------

    const accessToken = jwt.sign(
      { _id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" },
    );
    const refreshToken = jwt.sign(
      { _id: user._id, role: user.role },
      JWT_REFRESH_SECRET,
      { expiresIn: "7d" },
    );

    user.refreshToken = refreshToken;
    await user.save();

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
      role: user.role,
      role: user.role,
        employeeId: user.employeeId, // ✅ ADD THIS
      username: user.name, // 👈 send username
      userId: user._id,
    });
  } catch (err) {
    console.error("❌ Login error:", err); // log full error in Vercel logs
    return res
      .status(500)
      .json({ success: false, error: "Server error: " + err.message });
  }
});
// const LoginLocation = require("./models/LoginLocation");

// app.post("/save-login-location", async (req, res) => {
//   try {

//     const newLocation = new LoginLocation(req.body);

//     await newLocation.save();

//     res.status(201).json({
//       success: true,
//       message: "Login location saved succesfully",
//     });

//   } catch (err) {

//     console.error(err);

//     res.status(500).json({
//       success: false,
//       message: "Failed to save login location",
//     });
//   }
// });
// app.get("/save-login-location", async (req, res) => {

//   try {

//     const loginData = await LoginLocation.find()
//       .sort({ loginTime: -1 });

//     res.status(200).json(loginData);

//   } catch (err) {

//     console.error(err);

//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch login history",
//     });
//   }
// });

const LoginLocation = require("./models/LoginLocation");


app.post("/save-login-location", async (req, res) => {

  try {

    console.log("REQ BODY =>", req.body);

    const {
      employeeId,
      employeeName,
      latitude,
      longitude,
      address,
    } = req.body;

    // Validation
    // if (
    //   !employeeId ||
    //   !employeeName ||
    //   !latitude ||
    //   !longitude ||
    //   !address
    // ) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "All fields are required",
    //   });
    // }

    const newLocation = new LoginLocation({
      employeeId,
      employeeName,
      latitude,
      longitude,
      address,
      loginTime: new Date(),
    });

    await newLocation.save();

    res.status(201).json({
      success: true,
      message: "Login location saved successfully",
      data: newLocation,
    });

  } catch (err) {

    console.error(
      "Save Login Location Error:",
      err
    );

    res.status(500).json({
      success: false,
      message: err.message,
    });

  }
});

/* =========================
   GET LOGIN HISTORY API
========================= */

app.get("/save-login-location", async (req, res) => {

  try {

    const loginData = await LoginLocation.find()
      .sort({ loginTime: -1 });

    res.status(200).json(loginData);

  } catch (err) {

    console.error(
      "Fetch Login History Error:",
      err
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch login history",
    });

  }
});


app.get("/me", authenticate, async (req, res) => {
  try {
    console.log("Decoded User:", req.user); // 👈 log what jwt.verify returned
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("❌ /me route error:", err.message);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

app.post("/refresh-token", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(401).json({ message: "Refresh Token required" });

  try {
    const user = await User.findOne({ refreshToken });
    if (!user)
      return res.status(403).json({ message: "Invalid Refresh Token" });

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
      if (err)
        return res.status(403).json({ message: "Invalid Refresh Token" });

      // issue new access token
      const newAccessToken = jwt.sign(
        { _id: user._id, role: user.role },
        JWT_SECRET,
        { expiresIn: "1d" },
      );

      res.json({ accessToken: newAccessToken });
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

//get all departments
app.get("/getAllDepartments", async (req, res) => {
  try {
    const departments = await User.distinct("department");

    res.status(200).json({
      success: true,
      departments,
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch departments",
    });
  }
});

//get the list of employees belonging to a single manager by his/her id
// app.get("/employees/manager/:managerId", async (req, res) => {
//   try {
//     const { managerId } = req.params;

//     const employees = await User.find(
//       { reportingManager: managerId },   // filter employees
//       { name: 1, _id: 0 }                // return ONLY name
//     );

//     res.status(200).json({
//       success: true,
//       employees: employees.map(e => e.name) // return clean array of names
//     });

//   } catch (error) {
//     console.error("Error fetching employee names:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to fetch employee names for this manager"
//     });
//   }
// });
// get the list of employees belonging to a single manager by his/her id
app.get("/employees/manager/:managerId", async (req, res) => {
  try {
    const { managerId } = req.params;

    const employees = await User.find(
      { reportingManager: managerId }, // filter employees
      { name: 1, designation: 1 }, // return name + _id (default)
    );

    res.status(200).json({
      success: true,
      employees, // array of { _id, name }
    });
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employees for this manager",
    });
  }
});

app.get("/managers/:managerId/assigned-employees", async (req, res) => {
  try {
    const { managerId } = req.params;

    const employees = await User.find(
      { reportingManager: managerId }, // filter by manager
      {
        employeeId: 1,
        name: 1,
        role: 1,
        designation: 1,
        email: 1,
        contact: 1,
        department: 1,
        doj: 1,
      },
    ).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: employees.length,
      employees,
    });
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employees for this manager",
    });
  }
});
{
  /* jayashree : code for get all emplpyee */
}
app.get("/employees/teams", async (req, res) => {
  try {
    const employees = await User.find(
      {  role: { $in: ["employee"] }}, // ✅ only employees
      {
        employeeId: 1,
        name: 1,
        department: 1,
        email: 1,
        designation: 1,
        contact: 1,
        reportingManager: 1,
        role: 1,
        _id: 1, // ❌ hide _id 
      },
    )
      .populate("reportingManager", "name")
      .sort({ name: 1 });

      const employeesWithTeamLead = [];
    
    for (const emp of employees) {
      const empObj = emp.toObject();
      
      const teams = await Team.find({
        $or: [
          { members: emp._id },
          { assignToProject: emp._id }
        ]
      }).populate("teamLead", "_id name role");
      
      const teamLeads = [];
      
      if (teams && teams.length > 0) {
        for (const team of teams) {
          if (team.teamLead && team.teamLead.length > 0) {
            for (const tl of team.teamLead) {
              if (tl && tl.role === "Team_Leader") {
                const exists = teamLeads.some(t => t._id.toString() === tl._id.toString());
                if (!exists) {
                  teamLeads.push({
                    _id: tl._id,
                    name: tl.name,
                    role: tl.role
                  });
                }
              }
            }
          }
        }
      }
      empObj.teamLeads = teamLeads;
      empObj.teamLeadNames = teamLeads.length > 0 
        ? teamLeads.map(tl => tl.name).join(", ") 
        : "Not Assigned";
      
      employeesWithTeamLead.push(empObj);
    }

    res.status(200).json({
      success: true,
      count: employees.length,
      employees: employeesWithTeamLead, 
    });
  } catch (error) {
    console.error("Error fetching employees for teams:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
    });
  }
});
// Update employee profile
app.put(
  "/employees/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "aadharCardPdf", maxCount: 1 },
    { name: "panCardPdf", maxCount: 1 },
    { name: "appointmentLetter", maxCount: 1 },
    { name: "passbookPdf", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;
      let employee = await User.findById(id);
      if (!employee)
        return res.status(404).json({ error: "Employee not found" });

      const body = req.body;

      // ✅ Update simple fields
      const simpleFields = [
        "name",
        "email",
        "contact",
        "employeeId",
        "gender",
        "dob",
        "maritalStatus",
        "designation",
        "department",
        "salary",
        "role",
        "doj",
        "casualLeaveBalance",
        "sickLeaveBalance",
        "probationMonths",
        "pfNumber",
        "uanNumber",
      ];
      simpleFields.forEach((field) => {
        if (body[field]) employee[field] = body[field];
      });

      // ✅ Update nested objects
      ["currentAddress", "permanentAddress", "bankDetails"].forEach(
        (nested) => {
          if (body[nested]) {
            try {
              const obj =
                typeof body[nested] === "string"
                  ? JSON.parse(body[nested])
                  : body[nested];
              employee[nested] = { ...employee[nested], ...obj };
            } catch {}
          }
        },
      );

      // ✅ Update file fields from Cloudinary
      const files = req.files;
      if (files) {
        const fileMap = {
          image: "image",
          aadharCardPdf: "aadharCardPdf",
          panCardPdf: "panCardPdf",
          appointmentLetter: "appointmentLetter",
          passbookPdf: "passbookPdf",
        };

        Object.keys(fileMap).forEach((key) => {
          if (files[key]?.[0]) {
            const uploadedFile = files[key][0];
            // 🔹 For Cloudinary, use .path (which is the URL)
            const fileUrl = uploadedFile.path;

            if (key === "passbookPdf") {
              employee.bankDetails.passbookPdf = fileUrl;
            } else {
              employee[key] = fileUrl;
            }
          }
        });
      }

      await employee.save();
      res.json(employee);
    } catch (err) {
      console.error("Error updating employee:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

app.post("/logout", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res
      .status(400)
      .json({ success: false, message: "Refresh Token required" });
  }
  try {
    // Check if refresh token exists in DB
    const user = await User.findOne({ refreshToken });
    if (!user) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid Refresh Token" });
    }

    // Remove refresh token from DB
    user.refreshToken = null;
    await user.save();

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
//-------------------end login-logout---------------------------------

//------------------forgotpassword--------------------------------

// // sendpasswordlink
app.post("/sendpasswordlink", async (req, res) => {
  const { email } = req.body;
  // console.log("Email received:", email);

  if (!email) {
    return res.status(400).json({ status: 400, error: "Email is required" });
  }

  try {
    const userfind = await User.findOne({ email: email });
    //console.log("userfind",userfind)

    //token for reset password
    const token = jwt.sign({ _id: userfind._id }, JWT_SECRET, {
      expiresIn: "300s",
    });
    const setusertoken = await User.findByIdAndUpdate(
      { _id: userfind._id },
      { verifytoken: token },
      { new: true },
    );
    //console.log("setusertoken",setusertoken)
    const forLink = `https://ems-tms-client.vercel.app/forgotpassword/${userfind._id}/${setusertoken.verifytoken}`;
    const resetPasswordHtml = await rePasswordTemplate(forLink);

    if (setusertoken) {
      const mailOptions = {
        from: "komal@creativewebsolution.in",
        to: email,
        subject: "Password Reset Request - Employee Management System",
        html: resetPasswordHtml,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log("error", error);
          res.status(401).json({ status: 401, message: "mail not send" });
        } else {
          console.log("Email Sent Successfully", info.response);
          res
            .status(201)
            .json({ status: 201, message: "Email Sent Successfully" });
        }
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, error: "invalid user" });
  }
});
//verify user for forgot password
app.get("/forgotpassword/:id/:token", async (req, res) => {
  const { id, token } = req.params;
  //  console.log(id,token)
  try {
    const validUser = await User.findOne({ _id: id, verifytoken: token });
    //console.log(validUser)
    const verifytoken = jwt.verify(token, JWT_SECRET);
    if (validUser && verifytoken._id) {
      res.status(201).json({ status: 201, validUser });
    } else {
      res.status(401).json({ status: 401, message: "user not exist" });
    }
  } catch (error) {
    res.status(401).json({ status: 401, error });
  }
});
//change password
app.post("/forgotpassword/:id/:token", async (req, res) => {
  const { id, token } = req.params;
  const { password } = req.body;
  console.log(password);
  try {
    const validuser = await User.findOne({ _id: id, verifytoken: token });
    const verifyToken = jwt.verify(token, JWT_SECRET);
    if (validuser && verifyToken._id) {
      const newPassword = await bcrypt.hash(password, 10);
      const setnewuserpass = await User.findByIdAndUpdate(
        { _id: id },
        { password: newPassword },
      );
      setnewuserpass.save();
      res.status(201).json({ status: 201, setnewuserpass });
    } else {
      res.status(401).json({ status: 401, message: "user not exist" });
    }
  } catch (error) {
    res.status(401).json({ status: 401, error });
    console.log(error);
  }
});

//-------------------end forgot password------------------------------------

//get all employee details-showing data only admin
app.get("/getAllEmployees", authenticate, async (req, res) => {
  try {
    // Only admin can access
    if (
      req.user.role !== "admin" &&
      req.user.role !== "ceo" &&
      req.user.role !== "hr" &&
      req.user.role !== "manager" &&
      req.user.role !== "coo" &&
      req.user.role !== "md" &&
      req.user.role !== "Team_Leader"
    ) {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    // // Fetch all employees from DB
    // const employees = await User.find({ isDeleted: false }).select(
    //   "-password -refreshToken"
    // );

    // Return ALL employees including deleted
    const employees = await User.find()
      .populate("reportingManager", "name") //added jayu
      .select("-password -refreshToken");

    res.json(employees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});
app.get("/getEmployeeCount", async (req, res) => {
  try {
    const allowedRoles = ["hr", "manager", "employee", "it_support", "Team_Leader"];

    const employees = await User.find({
      isDeleted: false,
      $expr: {
        $in: [
          { $toLower: "$role" }, // normalize DB role to lowercase
          allowedRoles, // compare to normalized list
        ],
      },
    }).select("_id");

    return res.json({ totalEmployees: employees.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// DELETE EMPLOYEE API (Soft Delete)
app.delete("/soft/deleteEmployee/:id", authenticate, async (req, res) => {
  try {
    // Only admin, hr, or ceo coo md can delete
    if (
      req.user.role !== "admin" &&
      req.user.role !== "hr" &&
      req.user.role !== "ceo" &&
      req.user.role !== "coo" &&
      req.user.role !== "md"
    ) {
      return res.status(403).json({
        message: "Forbidden: Only admin/hr/ceo/coo//md can delete employees",
      });
    }

    const employeeId = req.params.id;

    // Soft delete (set isDeleted = true)
    const deletedEmployee = await User.findByIdAndUpdate(
      employeeId,
      { isDeleted: true },
      { new: true },
    );

    if (!deletedEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({
      message: "Employee deleted successfully",
      employee: deletedEmployee,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// // PERMANENTLY DELETE EMPLOYEE (HARD DELETE)
// app.delete("/deleteEmployee/:id", authenticate, async (req, res) => {
//   try {
//     // Only admin, ceo, hr can delete employees
//     if (!["admin", "ceo", "hr"].includes(req.user.role)) {
//       return res.status(403).json({ message: "Forbidden: Only admin/hr/ceo can delete employees" });
//     }

//     const employeeId = req.params.id;

//     // Hard delete — remove the document entirely
//     const deletedEmployee = await User.findByIdAndDelete(employeeId);

//     if (!deletedEmployee) {
//       return res.status(404).json({ message: "Employee not found" });
//     }

//     res.json({ success: true, message: "Employee permanently deleted from database." });
//   } catch (error) {
//     console.error("Error deleting employee:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });

// PERMANENTLY DELETE EMPLOYEE (HARD DELETE)
app.delete("/deleteEmployee/:id", authenticate, async (req, res) => {
  try {
    // Allow only admin/hr/ceo/md
    if (!["admin", "ceo", "hr", "coo", "md"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden: Only admin/hr/ceo/coo/md can delete employees",
      });
    }

    const employeeId = req.params.id;

    // Check employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // ✅ Delete all related records
    const [attendanceResult, leaveResult, notificationResult] =
      await Promise.all([
        Attendance.deleteMany({ employee: employeeId }), // delete attendance
        Leave.deleteMany({ employee: employeeId }), // delete leave records
        Notification.deleteMany({
          $or: [
            { user: employeeId },
            { "regularizationRef.employee": employeeId },
            { "leaveRef.employee": employeeId },
          ],
        }), // delete notifications related to that employee (optional)
      ]);

    // ✅ Finally delete the employee
    const deletedEmployee = await User.findByIdAndDelete(employeeId);

    if (!deletedEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({
      success: true,
      message: `Employee permanently deleted along with all related records.`,
      deletedCounts: {
        attendanceDeleted: attendanceResult.deletedCount,
        leavesDeleted: leaveResult.deletedCount,
        notificationsDeleted: notificationResult.deletedCount,
      },
    });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//admin can set the office location
const OfficeLocation = require("./models/OfficeLocationSchema");

// // Add or update office location
// app.post("/admin/office-location", async (req, res) => {
//   try {
//     const { name, lat, lng, address } = req.body;
// console.log(name)
//     let office = await OfficeLocation.findOne({ name });
//     if (office) {
//       office.lat = lat;
//       office.lng = lng;
//       office.address = address;
//     } else {
//       office = new OfficeLocation({ name, lat, lng, address });
//     }

//     await office.save();
//     res.json({ message: "Office location saved", office });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });

app.post("/admin/office-location", async (req, res) => {
  try {
    const { _id, name, lat, lng, address } = req.body;
    let office;

    if (_id) {
      // ✅ Update existing office by ID
      office = await OfficeLocation.findByIdAndUpdate(
        _id,
        { name, lat, lng, address },
        { new: true },
      );
    } else {
      // ✅ Create new if none exists
      office = new OfficeLocation({ name, lat, lng, address });
      await office.save();
    }

    res.json({ message: "Office location saved", office });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all office locations
app.get("/admin/office-location", async (req, res) => {
  try {
    const locations = await OfficeLocation.find();
    res.json(locations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Helper: get start of today
const getTodayRange = () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return { todayStart, todayEnd };
};
app.get("/today/:employeeId", authenticate, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { todayStart, todayEnd } = getTodayRange();

    const attendance = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    res.json({ attendance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// Helper function to calculate distance in meters
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}
//Check-in API

// Utility: calculate distance between two GPS points in meters
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius of the earth in meters
  const φ1 = lat1 * (Math.PI / 180);
  const φ2 = lat2 * (Math.PI / 180);
  const Δφ = (lat2 - lat1) * (Math.PI / 180);
  const Δλ = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d; // in meters
}

// // Check-in API
// app.post("/attendance/:id/checkin", authenticate, async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { lat, lng, address } = req.body;

//     if (!lat || !lng || !address) {
//       return res.status(400).json({ message: "Location required for check-in" });
//     }

//     // Get today
//     const today = getToday();

//     // Fetch office location
//     const office = await OfficeLocation.findOne({ name: "Pune Office" });
//     if (!office) return res.status(400).json({ message: "Office location not set" });

//     // If employee is WFO, check distance
//     const MAX_DISTANCE_METERS = 100; // allow 100m tolerance
//     const distance = getDistanceFromLatLonInMeters(
//       lat,
//       lng,
//       office.lat,
//       office.lng,

//     );

//     if (distance > MAX_DISTANCE_METERS) {
//       return res.status(400).json({ message: "You are not in the office" });
//     }

//     // Find or create attendance for today
//     let attendance = await Attendance.findOne({ employee: id, date: today });

//     if (attendance?.checkIn) {
//       return res.status(400).json({ message: "Already checked in today" });
//     }

//     if (!attendance) {
//       attendance = new Attendance({
//         employee: id,
//         date: today,
//         checkIn: new Date(),
//         checkInLocation: { lat: office.lat, lng: office.lng, address: office.address },
//         employeeCheckInLocation: { lat, lng, address: "Employee location" },
//         mode: "Office",
//         dayStatus: "Present",
//       });
//     } else {
//       attendance.checkIn = new Date();
//       attendance.checkInLocation = { lat: office.lat, lng: office.lng, address: office.address };
//       attendance.employeeCheckInLocation = { lat, lng, address: "Employee location" };
//       attendance.mode = "Office";
//     }

//     await attendance.save();
//     res.json({ message: "Check-in successful", attendance });
//   } catch (err) {
//     console.error("Check-in error:", err);
//     res.status(500).json({ message: err.message });
//   }
// });

// // ✅ Check-out API
// app.post("/attendance/:id/checkout", authenticate, async (req, res) => {
//   try {
//     const { lat, lng, address } = req.body; // get location from frontend
//     const today = getToday();

//     let attendance = await Attendance.findOne({
//       employee: req.params.id,
//       date: today,
//     });

//     if (!attendance?.checkIn) {
//       return res.status(400).json({ message: "Check-in first" });
//     }
//     if (attendance?.checkOut) {
//       return res.status(400).json({ message: "Already checked out today" });
//     }

//     if (!lat || !lng || !address) {
//       return res.status(400).json({ message: "Location required for check-out" });
//     }

//     attendance.checkOut = new Date();
//     attendance.checkOutLocation = { lat, lng, address };
//     attendance.employeeCheckOutLocation = { lat, lng, address: "Employee location" };

//     // Auto-calc working hours
//     const diffMs = attendance.checkOut - attendance.checkIn;
//     attendance.workingHours = Math.round(diffMs / (1000 * 60 * 60) * 100) / 100; // in hours, 2 decimals

//     await attendance.save();
//     res.json({ message: "Check-out successful", attendance });
//   } catch (err) {
//     console.error("Check-out error:", err);
//     res.status(500).json({ message: err.message });
//   }
// });

//above code is only for wfo and below is is form wfo and wfh
app.get("/attendance/on-leave-employees", authenticate, async (req, res) => {
  try {

    const allowedRoles = [
      "admin",
      "hr",
      "manager",
      "Team_Leader",
      "md",
      "ceo",
      "coo"
    ];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access Denied",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

   let filter = {
  status: "approved",
};

if (req.query.date) {

  const selectedDate = new Date(
    req.query.date
  );

  selectedDate.setHours(0, 0, 0, 0);

  const nextDay = new Date(selectedDate);

  nextDay.setDate(
    nextDay.getDate() + 1
  );

  filter.dateFrom = {
    $lt: nextDay,
  };

  filter.dateTo = {
    $gte: selectedDate,
  };

} else {

  // today's leave default
  filter.dateFrom = { $lt: tomorrow };

  filter.dateTo = { $gte: today };
}

    // Manager Filter
    if (req.user.role === "manager") {
      filter.reportingManager = req.user._id;
    }

    // TL Filter
    if (req.user.role === "Team_Leader") {

      const teams = await Team.find({
        teamLead: {
          $in: [req.user._id],
        },
      });

      const teamEmployeeIds = teams.flatMap(
        (team) => [
          ...(team.members || []),
          ...(team.assignToProject || []),
        ]
      );

      const leaveEmployees = await Leave.find({
        ...filter,
        employee: { $in: teamEmployeeIds },
      })
      .populate(
        "employee",
        "name employeeId designation department"
      )
      .sort({ appliedAt: -1 });

      return res.status(200).json({
        success: true,
        count: leaveEmployees.length,
        employees: leaveEmployees,
      });
    }

    // Admin / HR / Manager
    const leaveEmployees = await Leave.find(filter)
      .populate(
        "employee",
        "name employeeId designation department"
      )
      .sort({ appliedAt: -1 });

    return res.status(200).json({
      success: true,
      count: leaveEmployees.length,
      employees: leaveEmployees,
    });

  } catch (error) {

    console.error("On Leave Employees Error:", error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});
// app.post("/attendance/:id/checkin", authenticate, async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { lat, lng, address, mode = "Office" } = req.body;

    

//     if (!lat || !lng || !address) {
//       return res.status(400).json({ message: "Location required" });
//     }

//     const today = getToday();

//     let attendance = await Attendance.findOne({ employee: id, date: today });

//     if (attendance?.checkIn)
//       return res.status(400).json({ message: "Already checked in" });

//     if (mode === "Office") {
//       const office = await OfficeLocation.findOne({ name: "Creative Web Solution" });
//       if (!office)
//         return res.status(400).json({ message: "Office location not set" });

//       const distance = getDistanceFromLatLonInMeters(
//         lat,
//         lng,
//         office.lat,
//         office.lng,
//       );
//       if (distance > 100)
//         return res.status(400).json({ message: "You are not in the office" });

//       attendance = attendance || new Attendance({ employee: id, date: today });
//       attendance.checkInLocation = {
//         lat: office.lat,
//         lng: office.lng,
//         address: office.address,
//       };
//     }

//     // For WFH, just store employee location
//     if (mode === "WFH") {
//       attendance = attendance || new Attendance({ employee: id, date: today });
//     }

//     attendance.checkIn = new Date();
//     attendance.employeeCheckInLocation = { lat, lng, address };
//     attendance.mode = mode;
//     attendance.dayStatus = "Present";

//     await attendance.save();
//     res.json({ message: "Check-in successful", attendance });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: err.message });
//   }
// });
app.post("/attendance/:id/checkin", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng, address, mode = "Office" } = req.body;

    if (!lat || !lng || !address) {
      return res.status(400).json({
        message: "Location required",
      });
    }

    const today = getToday();

    let attendance = await Attendance.findOne({
      employee: id,
      date: today,
    });

    // Already checked in
    if (attendance?.checkIn) {
      return res.status(400).json({
        message: "Already checked in",
      });
    }

    // =========================
    // OFFICE VALIDATION
    // =========================
    if (mode === "Office") {
      const office = await OfficeLocation.findOne({
        name: "Creative Web Solution",
      });

      if (!office) {
        return res.status(400).json({
          message: "Office location not set",
        });
      }

      const distance = getDistanceFromLatLonInMeters(
        lat,
        lng,
        office.lat,
        office.lng
      );

      if (distance > 100) {
        return res.status(400).json({
          message: "You are not in the office",
        });
      }

      attendance =
        attendance ||
        new Attendance({
          employee: id,
          date: today,
        });

      attendance.checkInLocation = {
        lat: office.lat,
        lng: office.lng,
        address: office.address,
      };
    }

    // =========================
    // WFH
    // =========================
    if (mode === "WFH") {
      attendance =
        attendance ||
        new Attendance({
          employee: id,
          date: today,
        });
    }

    // =========================
    // CHECK-IN TIME
    // =========================
    const now = new Date();

    attendance.checkIn = now;

    attendance.employeeCheckInLocation = {
      lat,
      lng,
      address,
    };

    attendance.mode = mode;

    // =========================
    // LATE CHECK-IN LOGIC
    // =========================
    const isLate =
      now.getHours() > 9 ||
      (
        now.getHours() === 9 &&
        now.getMinutes() > 10
      );

    attendance.lateCheckIn = isLate;

    // =========================
    // COUNT PREVIOUS LATES
    // =========================
    if (isLate) {

      const previousLateCount =
        await Attendance.countDocuments({
          employee: id,
          lateCheckIn: true,
          date: { $lt: today },
        });

      // Today attempt number
      attendance.lateCheckInCount =
        previousLateCount + 1;
    } else {
      attendance.lateCheckInCount = 0;
    }

    attendance.dayStatus = "Present";

    await attendance.save();

    res.json({
      message: "Check-in successful",
      attendance,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: err.message,
    });
  }
});

app.post("/attendance/:id/checkout", authenticate, async (req, res) => {
  try {
    const { lat, lng, address, mode = "Office" } = req.body;
    const today = getToday();

    let attendance = await Attendance.findOne({
      employee: req.params.id,
      date: today,
    });
    if (!attendance?.checkIn)
      return res.status(400).json({ message: "Check-in first" });
    if (attendance?.checkOut)
      return res.status(400).json({ message: "Already checked out" });

    attendance.checkOut = new Date();
    attendance.employeeCheckOutLocation = { lat, lng, address };
    attendance.checkOutLocation =
      mode === "Office" ? attendance.checkOutLocation : undefined;

    // Calculate working hours
    const diffMs = attendance.checkOut - attendance.checkIn;
    attendance.workingHours =
      Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

    await attendance.save();
    res.json({ message: "Check-out successful", attendance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get today's status
app.get("/today", authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const attendance = await Attendance.findOne({
      userId: req.user.id,
      date: today,
    });
    res.json(attendance || {});
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

app.get("/attendance/today/:id", async (req, res) => {
  const { id } = req.params;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attendance = await Attendance.findOne({
    employee: id,
    date: today,
  });

  if (!attendance)
    return res.status(404).json({ message: "No record for today" });
  res.json({ attendance });
});

// GET: Today's check-in status for all employees
app.get("/attendance/today", authenticate, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // midnight

    // Only admin can access
    if (
      req.user.role !== "admin" &&
      req.user.role !== "ceo" &&
      req.user.role !== "hr" &&
      req.user.role !== "coo" &&
      req.user.role !== "md"
    ) {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    // Get all employees
    // Get all employees
    const employees = await User.find({
      role: { $in: ["hr", "manager", "employee", "Team_Leader"] },
    });

    // Get today's attendance records
    const attendanceRecords = await Attendance.find({
      date: today,
    });

    // Map employeeId to attendance
    const attendanceMap = {};
    attendanceRecords.forEach((att) => {
      attendanceMap[att.employee.toString()] = att; // <-- fixed
    });

    // Build response
    // const result = employees.map((emp) => ({
    //   _id: emp._id,
    //   name: emp.name,
    //   email: emp.email,
    //   contact: emp.contact,
    //   role: emp.role,
    //   designation: emp.designation,
    //   department: emp.department,
    //   doj: emp.doj,
    //   dob: emp.dob,

    //   hasCheckedIn: !!attendanceMap[emp._id.toString()],
    //   checkInTime: attendanceMap[emp._id.toString()]
    //     ? attendanceMap[emp._id.toString()].checkIn
    //     : null,

    //      checkOutTime: attendanceMap ? attendanceMap.checkOut : null, // ✅ add
    // }));

    const result = employees.map((emp) => {
      const att = attendanceMap[emp._id.toString()]; // <-- define att here
      return {
        _id: emp._id,
         employeeId: emp.employeeId,
        name: emp.name,
        email: emp.email,
        contact: emp.contact,
        role: emp.role,
        designation: emp.designation,
        department: emp.department,
        doj: emp.doj,
        dob: emp.dob,

        hasCheckedIn: !!att,
        checkInTime: att ? att.checkIn : null,
        checkOutTime: att ? att.checkOut : null, // ✅ now att exists
      };
    });

    // Count employees who haven't checked in
    const pendingCheckIn = result.filter((r) => !r.hasCheckedIn).length;

    res.json({
      totalEmployees: employees.length,
      pendingCheckIn,
      employees: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

//leave section
//leave section
// Utility: months since joining
function monthsSinceJoining(doj) {
  if (!doj) return 0;
  const now = new Date();
  return (
    (now.getFullYear() - doj.getFullYear()) * 12 +
    (now.getMonth() - doj.getMonth())
  );
}


// app.post("/leave/grant-yearly", async (req, res) => {
//   try {
//     const { sl, cl } = req.body; // yearly SL/CL to grant
//     const users = await User.find({ isDeleted: false });

//     let updated = [];
//     for (const user of users) {
//       if (monthsSinceJoining(user.doj) >= 6) {
//         user.sickLeaveBalance += sl;
//         user.casualLeaveBalance += cl;
//         await user.save();
//         updated.push(user._id);
//       }
//     }

//     res.json({ message: "Yearly leave credited", count: updated.length });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

//admin set leave working code
const YearlyLeaveSetting = require("./models/yearlyLeavesSettingsSchema");

app.post("/leave/grant-yearly", async (req, res) => {
  try {
    const { sl, cl } = req.body; // yearly SL/CL to grant
    const currentYear = new Date().getFullYear();

    // Fetch all active employees
    const users = await User.find({ isDeleted: false });
    let updated = [];
    // ✅ Check if already granted for this year
    const existingSetting = await YearlyLeaveSetting.findOne({
      year: currentYear,
    });
    if (existingSetting) {
      return res.status(400).json({
        message: `Yearly leaves already granted for ${currentYear}`,
      });
    }
    // ✅ Create a new YearlyLeaveSetting record
    const newSetting = new YearlyLeaveSetting({
      year: currentYear,
      sl,
      cl,
    });
    await newSetting.save();

    for (const user of users) {
      // Skip if employee hasn't completed 6 months
      if (monthsSinceJoining(user.doj) < 6) continue;

      // Skip if already granted this year
      if (user.lastYearlyLeaveGranted === currentYear) continue;

      // Reset old balances (no carry forward)
      user.sickLeaveBalance = 0;
      user.casualLeaveBalance = 0;

      // Add this year's yearly leave
      user.sickLeaveBalance += sl;
      user.casualLeaveBalance += cl;

      // Mark as granted for this year
      user.lastYearlyLeaveGranted = currentYear;

      await user.save();
      updated.push(user._id);
    }

    res.json({
      message: "Yearly leave credited successfully",
      count: updated.length,
    });
  } catch (err) {
    console.error("Error in /leave/grant-yearly:", err);
    res.status(500).json({ error: err.message });
  }
});



app.get("/leave/yearly-settings", async (req, res) => {
  try {
    const settings = await YearlyLeaveSetting.find().sort({ year: -1 });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Reset settings + reset employee leave balances
app.delete("/leave/reset-all", async (req, res) => {
  try {
    // Delete all yearly leave setting records
    await YearlyLeaveSetting.deleteMany({});

    // Reset employee balances
    const result = await User.updateMany(
      { isDeleted: false },
      {
        $set: {
          sickLeaveBalance: 0,
          casualLeaveBalance: 0,
          lastYearlyLeaveGranted: null,
        },
      },
    );

    res.json({
      message:
        "All yearly leave settings and employee balances have been reset.",
      updatedEmployees: result.modifiedCount,
    });
  } catch (err) {
    console.error("Error resetting yearly leaves:", err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: monthly leave allocation
app.post("/leave/grant-monthly", async (req, res) => {
  try {
    const { sl, cl } = req.body; // monthly SL/CL to grant
    const users = await User.find({ isDeleted: false });

    let updated = [];
    for (const user of users) {
      if (monthsSinceJoining(user.doj) >= 6) {
        user.sickLeaveBalance += sl;
        user.casualLeaveBalance += cl;
        await user.save();
        updated.push(user._id);
      }
    }

    res.json({ message: "Monthly leave credited", count: updated.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /leave/balance
app.get("/leave/balance", async (req, res) => {
  try {
    // Find any user (for admin view, you can later change this to logged-in user)
    const user = await User.findOne();

    // If no user found
    if (!user) {
      return res.status(404).json({ message: "No user found" });
    }

    // Return their leave balance
    res.json({
      sl: user.sickLeaveBalance,
      cl: user.casualLeaveBalance,
      lwp: user.LwpLeave,
    });
  } catch (err) {
    console.error("❌ Error fetching leave balance:", err);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: err.message });
  }
});

// Get employee leave balance
app.get("/leave/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name sickLeaveBalance casualLeaveBalance LwpLeave",
    );
    if (!user) return res.status(404).json({ message: "Employee not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//---------------------admin set leave balance and employee get leave balance--------------------------

const Leave = require("./models/LeaveSchema");

// get reoprting manager by id
app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate(
      "reportingManager",
      "name employeeId contact designation role image",
    ); // populate manager

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// app.post("/leave/apply", async (req, res) => {
//   try {
//     const {
//       employeeId,
//       reportingManagerId,
//       leaveType,
//       dateFrom,
//       dateTo,
//       duration,
//       reason,
//     } = req.body;

//     const employee = await User.findById(employeeId);
//     const manager = await User.findById(reportingManagerId);

//     if (!employee || !manager) {
//       return res.status(404).json({ error: "Employee or Manager not found" });
//     }

//     const leave = new Leave({
//       employee: employee._id,
//       reportingManager: manager._id,
//       leaveType,
//       dateFrom,
//       dateTo,
//       duration,
//       reason,
//     });

//     await leave.save();

//     // 🔹 Update Attendance for all dates in range
//     let current = new Date(dateFrom);
//     const end = new Date(dateTo);

//     while (current <= end) {
//       await Attendance.findOneAndUpdate(
//         { employee: employee._id, date: current },
//         {
//           $set: {
//             dayStatus: "Leave",
//             leaveType,
//             leaveRef: leave._id,
//           },
//         },
//         { upsert: true, new: true }
//       );
//       current.setDate(current.getDate() + 1);
//     }

//     res.status(201).json({ message: "Leave applied successfully", leave });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Server error" });
//   }
// });



const Notification = require("./models/notificationSchema");


//   try {
//     const {
//       employeeId,
//       leaveType,
//       dateFrom,
//       dateTo,
//       duration,
//       reason,
//       reportingManagerId,
//     } = req.body;

//     const employee = await User.findById(employeeId);
//     if (!employee) return res.status(404).json({ error: "Employee not found" });

//     const start = new Date(dateFrom);
//     const end = new Date(dateTo);
//     start.setHours(0, 0, 0, 0);
//     end.setHours(0, 0, 0, 0);

//     //  // ✅ Check if leave already exists on same or overlapping date range
//     //   const overlappingLeave = await Leave.findOne({
//     //     employee: employeeId,
//     //     status: { $ne: "rejected" }, // ignore rejected
//     //     $or: [
//     //       {
//     //         dateFrom: { $lte: end },
//     //         dateTo: { $gte: start },
//     //       },
//     //     ],
//     //   });

//     //   if (overlappingLeave) {
//     //     return res.status(400).json({
//     //       error:
//     //         "You already have a leave applied for one or more of these dates.",
//     //     });
//     //   }

//     const dayCount =
//       duration === "half"
//         ? 0.5
//         : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

//     // ✅ Check balance before allowing
//     if (leaveType === "SL" && employee.sickLeaveBalance < dayCount) {
//       return res.status(400).json({
//         error: "No Sick Leave balance available. Please apply for LWP.",
//       });
//     }
//     if (leaveType === "CL" && employee.casualLeaveBalance < dayCount) {
//       return res.status(400).json({
//         error: "No Casual Leave balance available. Please apply for LWP.",
//       });
//     }

//     // Create new leave request
//     const leave = new Leave({
//       employee: employeeId,
//       leaveType,
//       dateFrom,
//       dateTo,
//       duration,
//       reason,
//       reportingManager: reportingManagerId,
//       status: "pending",
//       appliedAt: new Date(),
//     });

//     await leave.save();

//     // Notify reporting manager
//     if (reportingManagerId) {
//       await Notification.create({
//         user: reportingManagerId,
//         type: "Leave",
//         message: `New leave request from ${employee.name} (${new Date(
//           dateFrom,
//         ).toDateString()} - ${new Date(dateTo).toDateString()})`,
//         leaveRef: leave._id,
//       });
//     }

//     // Notify all admins
//     const admins = await User.find({
//       role: { $in: ["admin", "hr", "ceo", "coo", "md"] },
//     });
//     for (let admin of admins) {
//       await Notification.create({
//         user: admin._id,
//         type: "Leave",
//         message: `New leave request from ${employee.name} (${new Date(
//           dateFrom,
//         ).toDateString()} - ${new Date(dateTo).toDateString()})`,
//         leaveRef: leave._id,
//       });
//     }

//     res.json({ message: "Leave applied successfully!", leave });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });
//prateek code sandwich policy
async function calculateWithSandwich(
  employeeId,
  start,
  end,
  holidays,
  weeklyOffData,
  duration,
  leaveType
) {

  // 🔹 Base days
  let totalDays =
    duration === "half"
      ? 0.5
      : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  // 🔹 Get adjacent leaves
  const { prev, next } = await getAdjacentLeaves(
    employeeId,
    start,
    end,
    leaveType,
    false
  );

  let extraDays = 0;

  // 🔥 Sandwich from previous
  if (prev) {
    extraDays += getSandwichDays(
      prev.dateTo,
      start,
      holidays,
      weeklyOffData
    );
  }

  // 🔥 Sandwich from next
  if (next) {
    extraDays += getSandwichDays(
      end,
      next.dateFrom,
      holidays,
      weeklyOffData
    );
  }

  return totalDays + extraDays;
}

app.post("/leave/apply", async (req, res) => {
  try {
    const {
      employeeId,
      leaveType,
      dateFrom,
      dateTo,
      duration,
      reason,
      reportingManagerId,
    } = req.body;

    const employee = await User.findById(employeeId);
    if (!employee)
      return res.status(404).json({ error: "Employee not found" });

    // Normalize dates
    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // Fetch weekly off data
    const weeklyOffData = await WeeklyOff.findOne({
      year: new Date().getFullYear(),
    });

    // 🔥 Correct holiday fetch
    const holidayDocs = await Holiday.find();

    const holidays = holidayDocs.map(h => ({
      date: h.date
    }));

    console.log("📅 Holidays in backend:", holidays);

    // -----------------------------
    // 🔴 VALIDATION BLOCK (IMPORTANT)
    // -----------------------------

    const isHoliday = (date) => {
      const dateStr = formatDateLocal(date);

      return holidays.some((h) => {
        const holidayDate = typeof h.date === "string"
          ? h.date
          : formatDateLocal(h.date);

        return holidayDate === dateStr;
      });
    };
    const isSunday = (date) => getDayOfWeek(date) === 0;

    const isNthSaturdayOff = (date) => {
      if (getDayOfWeek(date) !== 6) return false;

      const saturdayNumber = getSaturdayOfMonth(date);
      const offSaturdays = weeklyOffData?.saturdays || [1, 3, 5];

      return offSaturdays.includes(saturdayNumber);
    };

    const isOffDay = (date) =>
      isSunday(date) || isNthSaturdayOff(date) || isHoliday(date);

    // ❌ Block leave if start OR end is off day
    // if (isOffDay(start) || isOffDay(end)) {
    //   return res.status(400).json({
    //     error: "❌ Cannot apply leave on weekly off or holiday.",
    //   });
    // }
    const { prev , next } = await getAdjacentLeaves(
      employeeId,
      start,
      end,
      leaveType,
      false
    );

    console.log("START:", start);
    console.log("PREV LEAVE:", prev);

    
    // let finalStart = new Date(start);
    // let finalEnd = new Date(end);
    // let shouldMergePrev = false;
    // let shouldMergeNext = false;
    // const isWorkingSaturday = getDayOfWeek(start) === 6 && !isNthSaturdayOff(start);

    // // -----------------------------
    // // ✅ HR POLICY TOTAL CALCULATION
    // // -----------------------------

    // const totalDays = calculateTotalLeaveDays(
    //   finalStart,
    //   finalEnd,
    //   weeklyOffData,
    //   duration,
    //   holidays
    // );

    // console.log("TOTAL DAYS (HR RULE):", totalDays);



// -----------------------------
    // ✅ HR POLICY TOTAL CALCULATION
    // -----------------------------

    // const totalDays = calculateTotalLeaveDays(
    //   weeklyOffData,
    //   duration,
    //   holidays
    // );

    //const totalDays = calculateBaseDays(start, end, duration);
    const totalDays = await calculateWithSandwich(
      employeeId,
      start,
      end,
      holidays,
      weeklyOffData,
      duration,
      leaveType
    );
    console.log("TOTAL DAYS (FINAL):", totalDays);

    console.log("TOTAL DAYS (HR RULE):", totalDays);
    // -----------------------------
    // Leave balance check
    // -----------------------------

    // if (leaveType === "SL" && employee.sickLeaveBalance < totalDays) {
    //   return res.status(400).json({
    //     error: `No Sick Leave balance. Required: ${totalDays}, Available: ${employee.sickLeaveBalance}`,
    //   });
    // }

    // if (leaveType === "CL" && employee.casualLeaveBalance < totalDays) {
    //   return res.status(400).json({
    //     error: `No Casual Leave balance. Required: ${totalDays}, Available: ${employee.casualLeaveBalance}`,
    //   });
    // }
let warning = null;
if (leaveType === "SL" && employee.sickLeaveBalance < totalDays) {
  warning = `Only ${employee.sickLeaveBalance} days available. Remaining will be LOP`;
}

if (leaveType === "CL" && employee.casualLeaveBalance < totalDays) {
  warning = `Only ${employee.casualLeaveBalance} days available. Remaining will be LOP`;
}

    // Create leave
    const leave = new Leave({
      employee: employeeId,
      leaveType,
      dateFrom,
      dateTo,
      duration,
      reason,
      reportingManager: reportingManagerId || null,
      status: "pending",
      appliedAt: new Date(),
      totalDays,
    });

    await leave.save();

    // email logic
    
    try {
      const leaveApplicationHtml = await leaveApplicationTemplate(
        employee.name,
        employee.employeeId,
        employee.designation || 'N/A',
        employee.department || 'N/A',
        leaveType,
        dateFrom,
        dateTo,
        duration,
        reason || 'No reason provided',
        employee.email,
        "Pending",
      );
    
      let reportingManagerEmail = null;
      if (reportingManagerId) {
        const manager = await User.findById(reportingManagerId).select("email");
        if (manager && manager.email) {
          reportingManagerEmail = manager.email;
        }
      }
    
      const ccRoles = ["admin", "hr", "ceo", "md","coo"];
      const ccUsers = await User.find({ 
        role: { $in: ccRoles },
        isDeleted: { $ne: true },
        email: { $exists: true, $ne: null }
      }).select("email");
    
      const ccEmails = ccUsers.map(u => u.email);
    
      const teams = await Team.find({
        assignToProject: { $in: [employeeId] }
      }).populate("teamLead", "email role");
    
      const tlEmails = new Set();
      teams.forEach(team => {
        if (team.teamLead && team.teamLead.length) {
          team.teamLead.forEach(tl => {
            if (tl && tl.role === "Team_Leader" && tl.email) {
              tlEmails.add(tl.email);
            }
          });
        }
      });
    
      const allCcEmails = [...ccEmails, ...tlEmails];
    
      if (reportingManagerEmail) {
        await transporter.sendMail({
          from: `"${employee.name}" <${employee.email}>`,
          to: reportingManagerEmail,
          cc: allCcEmails.join(','),
          subject: `Leave Application - ${employee.name} (${employee.employeeId}) - ${leaveType} Leave`,
          html: leaveApplicationHtml,
        });
        console.log(`Leave email sent to Manager: ${reportingManagerEmail}, CC: ${allCcEmails.length} recipients`);
      } else if (allCcEmails.length > 0) {
    
        await transporter.sendMail({
          from: `"${employee.name}" <${employee.email}>`,
          to: allCcEmails[0],
          cc: allCcEmails.slice(1).join(','),
          subject: `Leave Application - ${employee.name} (${employee.employeeId}) - ${leaveType} Leave`,
          html: leaveApplicationHtml,
        });
        console.log(`Leave email sent (no manager), CC: ${allCcEmails.length} recipients`);
      }
    } catch (emailErr) {
      console.error("Email sending failed:", emailErr.message);
    }
    
// ========== END EMAIL SENDING ==========
    // email logic end 



    let finalRole = employee.role?.toUpperCase() || "EMPLOYEE";
    if (employee.role === "Team_Leader") finalRole = "Team_Leader";
    if (employee.role === "IT_Support") finalRole = "IT_Support";
    const teams = await Team.find({
      assignToProject: { $in: [employeeId] }
    }).populate("teamLead", "_id name role");

    const notifiedTLs = new Set();

    teams.forEach(team => {
      if (team.teamLead && team.teamLead.length) {
        team.teamLead.forEach(tl => {
          if (tl && tl.role === "Team_Leader" && tl._id.toString() !== employeeId && !notifiedTLs.has(tl._id.toString())) {
            notifiedTLs.add(tl._id.toString());
            console.log(`   ${tl.name}`);
            
            // Send noti to tl
            Notification.create({
              user: tl._id,
              type: "Leave",
              message: `New leave request from ${employee.name} (${new Date(dateFrom).toDateString()} - ${new Date(dateTo).toDateString()})`,
              leaveRef: leave._id,
              triggeredBy: employeeId,
              triggeredByRole: finalRole,
            });
          }
        });
      }
    });

    // Notify reporting manager
    if (reportingManagerId) {
      await Notification.create({
        user: reportingManagerId,
        type: "Leave",
        message: `New leave request from ${employee.name} (${new Date(
          dateFrom,
        ).toDateString()} - ${new Date(dateTo).toDateString()})`,
        leaveRef: leave._id,
        triggeredBy:employeeId,
        triggeredByRole: finalRole,
      });
    }

    // Notify all admins
    const admins = await User.find({
      role: { $in: ["admin", "hr", "ceo", "coo", "md"] },
    });
    for (let admin of admins) {
      await Notification.create({
        user: admin._id,
        type: "Leave",
        message: `New leave request from ${employee.name} (${new Date(
          dateFrom,
        ).toDateString()} - ${new Date(dateTo).toDateString()})`,
        leaveRef: leave._id,
        triggeredBy:employeeId,
        triggeredByRole: finalRole,
      });
    }

    res.json({
      message: "Leave applied successfully!",
      leave,
      totalDays,
      warning,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});






// rutuja api to get emp tl 26-03-2026
app.get("/employee/:employeeId/team-leader", async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json([]);
    }

    const teams = await Team.find({
      assignToProject: { $in: [employeeId] }
    }).populate({
      path: "teamLead",
      select: "name email employeeId designation role image contact"
    });

    if (!teams || teams.length === 0) {
      return res.status(200).json([]);
    }

    const teamLeaders = [];
    const uniqueIds = new Set();

    teams.forEach(team => {
      if (team.teamLead && team.teamLead.length > 0) {
        team.teamLead.forEach(lead => {
          if (lead && lead.role === "Team_Leader" && !uniqueIds.has(lead._id.toString())) {
            uniqueIds.add(lead._id.toString());
            teamLeaders.push({
              _id: lead._id,
              name: lead.name,
              email: lead.email,
              employeeId: lead.employeeId,
              designation: lead.designation,
              role: lead.role,
              contact: lead.contact,
              image: lead.image
            });
          }
        });
      }
    });
    res.status(200).json(teamLeaders);

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json([]);
  }
});

//rutuja api to get tl assign leave req(26-03-2026)
app.get("/leave/team-leader/:teamLeadId", async (req, res) => {
  try {
    const { teamLeadId } = req.params;

    const teams = await Team.find({ teamLead: teamLeadId })
      .populate("assignToProject", "_id");

    const memberIds = [];
    teams.forEach(team => {
      if (team.assignToProject) {
        team.assignToProject.forEach(member => {
          if (member._id.toString() !== teamLeadId) {
            memberIds.push(member._id.toString());
          }
        });
      }
    });

    if (memberIds.length === 0) {
      return res.status(200).json({
        success: true,
        leaves: []
      });
    }

    const leaves = await Leave.find({
      employee: { $in: memberIds }
    })
      .populate("employee", "name employeeId designation")
      .populate("approvedBy", "name role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      leaves: leaves
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


app.post("/leave/calculate", async (req, res) => {
  try {
    const { employeeId, dateFrom, dateTo, duration, leaveType } = req.body;

    const start = new Date(dateFrom);
    const end = new Date(dateTo);

    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);

    // Weekly offs
    const weeklyOffData = await WeeklyOff.findOne({
      year: new Date().getFullYear(),
    });

    // Holidays
    const holidayDocs = await Holiday.find();
    const holidays = holidayDocs.map(h => ({
      date: h.date
    }));

    // :white_check_mark: SINGLE SOURCE OF TRUTH
    // const totalDays = await calculateWithSandwich(
    //   employeeId,
    //   start,
    //   end,
    //   holidays,
    //   weeklyOffData,
    //   duration,
    //   leaveType
    // );
    const preview =
  await simulateLeaveChain(
    employeeId,
    {
      employee: employeeId,
      leaveType,
      dateFrom: start,
      dateTo: end,
      duration
    },
    holidays,
    weeklyOffData
  );
    // console.log("TOTAL DAYS (FINAL):", totalDays);

    //return res.json({ totalDays });

    // return res.json({
    //   totalDays,
    //   preview: {
    //     totalDays,
    //     isSandwich: totalDays > 1,
    //     leaveType,
    //   }
    // });
    return res.json({

  totalDays:
    preview?.totalDays || 0,

  preview: {

    actualDays:
      preview?.actualDays || 0,

    sandwichDays:
      preview?.sandwichDays || 0,

    totalDays:
      preview?.totalDays || 0,

    isSandwich:
      preview?.isSandwich || false,

    previousApprovedLeave:
      preview?.previousApprovedLeave || 0,

    newAdditionalDeduction:
      preview?.newAdditionalDeduction || 0,
    }
  });

  } catch (err) {
    console.error("Error calculating leave:", err);
    res.status(500).json({ error: "Calculation failed" });
  }
});

app.get("/notifications/:userId", async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.params.userId })
      .populate("leaveRef", "leaveType dateFrom dateTo status")
      .populate("regularizationRef", "date regularizationRequest.status")
      .populate("ticketRef", "ticketId category priority status")
      // .populate("eventRef", "name date description")
      .sort({ createdAt: -1 });

    res.json(notifications);
  } catch (err) {
    console.error("Error fetching notifications:", err); // <-- full error
    res.status(500).json({ error: err.message });
  }
});

//Mark Notification as Read
app.put("/notifications/:id/read", async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true },
    );
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all leave requests for a manager
app.get("/manager/:managerId", async (req, res) => {
  try {
    const { managerId } = req.params;

    const leaves = await Leave.find({ reportingManager: managerId })
      .populate("employee", "name email employeeId contact")
      .populate("reportingManager", "name email employeeId");

    res.json(leaves);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/leave/manager/:managerId", async (req, res) => {
  try {
    const { managerId } = req.params;

    if (!managerId) {
      return res.status(400).json({ message: "Manager ID is required" });
    }

    const leaves = await Leave.find({ reportingManager: managerId })
      .populate("employee", "name email employeeId department")
      .populate("reportingManager", "name email employeeId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 2. Get My Leaves (Employee)
app.get("/leave/my/:employeeId", async (req, res) => {
  try {
    const leaves = await Leave.find({ employee: req.params.employeeId })
    .sort({
      createdAt: -1,
    });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all leaves (Admin/HR)
app.get("/leaves", async (req, res) => {
  try {
    const leaves = await Leave.find()
      .populate("employee", "name email employeeId department") // employee details
      .populate("reportingManager", "name email employeeId department") // manager details
      .populate("approvedBy", "name role")
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all leaves assigned to a specific manager
app.get("/leaves/manager/:managerId", async (req, res) => {
  try {
    const { managerId } = req.params;

    const leaves = await Leave.find({ reportingManager: managerId })
      .populate("employee", "name email employeeId department")
      .populate("reportingManager", "name email employeeId department") // optional
      .populate("approvedBy", "name role")
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// app.put("/leave/:leaveId/status", async (req, res) => {
//   try {
//     const { status, userId, role } = req.body; // role: "manager" or "admin"
//     const leaveId = req.params.leaveId;

//     const leave = await Leave.findById(leaveId).populate("employee");
//     if (!leave) return res.status(404).json({ error: "Leave not found" });

//     const employee = leave.employee;
//     if (!employee) return res.status(404).json({ error: "Employee not found" });

//     // Manager can approve only their reporting leaves
//     if (role === "manager" && leave.reportingManager.toString() !== userId) {
//       return res.status(403).json({ error: "Not authorized" });
//     }

//     // Deduct leave only if approved and not already approved
//     if (status === "approved" && leave.status !== "approved") {
//       const start = new Date(leave.dateFrom);
//       const end = new Date(leave.dateTo);
//       start.setHours(0, 0, 0, 0);
//       end.setHours(0, 0, 0, 0);

//       const dayCount =
//         leave.duration === "half"
//           ? 0.5
//           : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

//       if (leave.leaveType === "SL") {
//         if (employee.sickLeaveBalance < dayCount)
//           return res.status(400).json({ error: "Not enough Sick Leave balance" });
//         employee.sickLeaveBalance -= dayCount;
//       } else if (leave.leaveType === "CL") {
//         if (employee.casualLeaveBalance < dayCount)
//           return res.status(400).json({ error: "Not enough Casual Leave balance" });
//         employee.casualLeaveBalance -= dayCount;
//       } else if (leave.leaveType === "LWP") {
//         employee.LwpLeave += dayCount;
//       }

//       // Update attendance for each leave date
//       let current = new Date(start);
//       while (current <= end) {
//         await Attendance.findOneAndUpdate(
//           { employee: employee._id, date: current },
//           {
//             $set: {
//               dayStatus: "Leave",
//               leaveType: leave.leaveType,
//               leaveRef: leave._id,
//             },
//           },
//           { upsert: true }
//         );
//         current.setDate(current.getDate() + 1);
//       }

//       employee.lastLeaveUpdate = new Date();
//       await employee.save();
//     }

//     // Update leave
//     leave.status = status;
//     leave.approvedBy = userId;
//     leave.approvedByRole = role; // ✅ only store role
//     await leave.save();

//     // ✅ Create notification for the employee
//     await Notification.create({
//       user: employee._id,
//       type: "Leave",
//       message: `Your leave request (${new Date(leave.dateFrom).toDateString()} - ${new Date(leave.dateTo).toDateString()}) has been ${status}.`,
//       leaveRef: leave._id,
//     });

//     // ✅ Notification for all admins
//     const admins = await User.find({ role: { $in: ["admin", "hr", "ceo"] } });
//     for (let admin of admins) {
//       await Notification.create({
//         user: admin._id,
//         type: "Leave",
//         message: `${employee.name}'s leave request (${new Date(leave.dateFrom).toDateString()} - ${new Date(leave.dateTo).toDateString()}) has been ${status} by ${role}.`,
//         leaveRef: leave._id,
//       });
//     }

//     // Send response
//     return res.json({
//       message: `Leave ${status} successfully`,
//       leave,
//       employeeBalance: {
//         sickLeave: employee.sickLeaveBalance,
//         casualLeave: employee.casualLeaveBalance,
//         LwpLeave: employee.LwpLeave,
//       },
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

// Helper function to find sandwich days (weekends/holidays between leaves)
// 🥪 Helper function: Find sandwich leave days

// ------------------- MAIN ROUTE -------------------
// app.put("/leave/:leaveId/status", async (req, res) => {
//   try {
//     const { status, userId, role } = req.body; // role: "manager" or "admin"
//     const leaveId = req.params.leaveId;

//     const leave = await Leave.findById(leaveId).populate("employee");
//     if (!leave) return res.status(404).json({ error: "Leave not found" });

//     const employee = leave.employee;
//     if (!employee) return res.status(404).json({ error: "Employee not found" });

//     // ✅ Authorization check
//     if (role === "manager" && leave.reportingManager.toString() !== userId) {
//       return res.status(403).json({ error: "Not authorized" });
//     }

//     // ✅ Deduct leave only if approved and not already approved
//     if (status === "approved" && leave.status !== "approved") {
//       const start = new Date(leave.dateFrom);
//       const end = new Date(leave.dateTo);
//       start.setHours(0, 0, 0, 0);
//       end.setHours(0, 0, 0, 0);

//       // base leave count
//       let dayCount =
//         leave.duration === "half"
//           ? 0.5
//           : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

//       // 🥪 1. Get sandwich leave days (weekly off / holiday between)
//       const sandwichDays = await getSandwichDays(start, end);
//       const totalLeaveDays = dayCount + sandwichDays.length;

//       // 🥪 2. Deduct from balance (include sandwich days)
//       if (leave.leaveType === "SL") {
//         if (employee.sickLeaveBalance < totalLeaveDays)
//           return res.status(400).json({ error: "Not enough Sick Leave balance" });
//         employee.sickLeaveBalance -= totalLeaveDays;
//       } else if (leave.leaveType === "CL") {
//         if (employee.casualLeaveBalance < totalLeaveDays)
//           return res.status(400).json({ error: "Not enough Casual Leave balance" });
//         employee.casualLeaveBalance -= totalLeaveDays;
//       } else if (leave.leaveType === "LWP") {
//         employee.LwpLeave += totalLeaveDays;
//       }

//       // 🟢 3. Update attendance for each leave day
//       let current = new Date(start);
//       while (current <= end) {
//         await Attendance.findOneAndUpdate(
//           { employee: employee._id, date: current },
//           {
//             $set: {
//               dayStatus: "Leave",
//               leaveType: leave.leaveType,
//               leaveRef: leave._id,
//               isSandwich: false,
//             },
//           },
//           { upsert: true }
//         );
//         current.setDate(current.getDate() + 1);
//       }

//       // 🟣 4. Mark sandwich days as Leave
//       for (let day of sandwichDays) {
//         await Attendance.findOneAndUpdate(
//           { employee: employee._id, date: day },
//           {
//             $set: {
//               dayStatus: "Leave",
//               leaveType: leave.leaveType,
//               leaveRef: leave._id,
//               isSandwich: true,
//             },
//           },
//           { upsert: true }
//         );
//       }

//       // 🟡 5. Save employee balance
//       employee.lastLeaveUpdate = new Date();
//       await employee.save();
//     }

//     // 🧾 Update leave status
//     leave.status = status;
//     leave.approvedBy = userId;
//     leave.approvedByRole = role;
//     await leave.save();

//     // 🔔 Notification for employee
//     await Notification.create({
//       user: employee._id,
//       type: "Leave",
//       message: `Your leave request (${new Date(
//         leave.dateFrom
//       ).toDateString()} - ${new Date(leave.dateTo).toDateString()}) has been ${status}.`,
//       leaveRef: leave._id,
//     });

//     // 🔔 Notification for all admins
//     const admins = await User.find({ role: { $in: ["admin", "hr", "ceo"] } });
//     for (let admin of admins) {
//       await Notification.create({
//         user: admin._id,
//         type: "Leave",
//         message: `${employee.name}'s leave request (${new Date(
//           leave.dateFrom
//         ).toDateString()} - ${new Date(leave.dateTo).toDateString()}) has been ${status} by ${role}.`,
//         leaveRef: leave._id,
//       });
//     }

//     // ✅ Response
//     return res.json({
//       message: `Leave ${status} successfully`,
//       leave,
//       employeeBalance: {
//         sickLeave: employee.sickLeaveBalance,
//         casualLeave: employee.casualLeaveBalance,
//         LwpLeave: employee.LwpLeave,
//       },
//     });
//   } catch (err) {
//     console.error("Error updating leave status:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// 🧩 Helper function — get all sandwich days (weekly off or holidays between leaves)
// const getSandwichDays = async (start, end) => {
//   const sandwichDays = [];

//   const weeklyOffData = await WeeklyOff.findOne({
//     year: new Date(start).getFullYear(),
//   });

//   const offSaturdays = weeklyOffData?.saturdays || [1,3,5];
//   const holidays = weeklyOffData?.holidays || [];

//   const isHoliday = (d) =>
//     holidays.some(
//       (h) => new Date(h.date).toDateString() === d.toDateString()
//     );
//   const isSunday = (d) => d.getDay() === 0;

//   const isNthSaturday = (d) => {
//     if (d.getDay() !== 6) return false;
//     const nth = Math.ceil(d.getDate() / 7);
//     return offSaturdays.includes(nth);
//   };

//   const isOffDay = (d) => isSunday(d) || isNthSaturday(d) || isHoliday(d);

//   const current = new Date(start);
//   current.setDate(current.getDate() + 1); // start after fromDate
  
//   const toDate = new Date(end);
//   toDate.setDate(toDate.getDate() - 1); // end before toDate

//   while (current <= toDate) {
//     const day = current.getDay();
//     const isSunday = day === 0;
//     const isNthSaturday = weeklyOffData?.saturdays?.includes(
//       Math.ceil(current.getDate() / 7),
//     );
//     const isHoliday = weeklyOffData?.holidays?.some(
//       (h) => new Date(h.date).toDateString() === current.toDateString(),
//     );

//     // if (isSunday || isNthSaturday || isHoliday) {
//     //   sandwichDays.push(new Date(current));
//     // }
//   if (isOffDay(current)) {
//   const prev = new Date(current);
//   prev.setDate(prev.getDate() - 1);

//   const next = new Date(current);
//   next.setDate(next.getDate() + 1);

//   if (prev >= start && next <= end) {
//     sandwichDays.push(new Date(current));
//   }
// }

//   current.setDate(current.getDate() + 1);
//   }
  
//   return sandwichDays;
// };

// ------------------------------
// Utility Helpers
// ------------------------------

// Normalize to local midnight (NO UTC mixing)
// ===============================
// Date Helpers
// ===============================

const normalizeDate = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// 🔹 Base days (no sandwich)
function calculateBaseDays(start, end, duration) {
  if (duration === "half") return 0.5;

  return (
    Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
  );
}

// 🔹 Check if date is off day
function isOffDay(date, holidays, weeklyOffData) {
  const day = date.getDay();

  const isSunday = day === 0;

  const isSaturday = day === 6;
  const nth = Math.ceil(date.getDate() / 7);
  const isOffSaturday = (weeklyOffData?.saturdays || [1, 3, 5]).includes(nth);

  const isHoliday = holidays.some(
    (h) => new Date(h.date).toDateString() === date.toDateString()
  );

  return isSunday || (isSaturday && isOffSaturday) || isHoliday;
}


function isNthSaturdayOff(date, weeklyOffData) {
  if (getDayOfWeek(date) !== 6) return false;

  const saturdayNumber = getSaturdayOfMonth(date);
  const offSaturdays = weeklyOffData?.saturdays || [1, 3, 5];

  return offSaturdays.includes(saturdayNumber);
}

function getSandwichDays(prevEnd, currentStart, holidays, weeklyOffData) {

  let gapStart = new Date(prevEnd);
  gapStart.setHours(0,0,0,0);
  gapStart.setDate(gapStart.getDate() + 1);

  let gapEnd = new Date(currentStart);
  gapEnd.setHours(0,0,0,0);
  gapEnd.setDate(gapEnd.getDate() - 1);

  let temp = new Date(gapStart);
  let gapDays = 0;
  let allOff = true;

  // 🔥 detect working Saturday (based on leave start)
  // const leaveStartsOnWorkingSaturday =
  //   getDayOfWeek(prevEnd) === 6 &&
  //   !(
  //     weeklyOffData?.saturdays || [1,3,5]
  //   ).includes(getSaturdayOfMonth(prevEnd));

  // while (temp <= gapEnd) {

  //   const isSunday = getDayOfWeek(temp) === 0;

  //   const isImmediateSunday =
  //     isSunday && temp.getTime() === gapStart.getTime();

  //   // ✅ skip Sunday sandwich
  //   if (leaveStartsOnWorkingSaturday && isImmediateSunday) {
  //     temp.setDate(temp.getDate() + 1);
  //     continue;
  //   }

  //   if (!isOffDay(temp, holidays, weeklyOffData)) {
  //     allOff = false;
  //     break;
  //   }

  //   gapDays++;
  //   temp.setDate(temp.getDate() + 1);
  // }
  while (temp <= gapEnd) {

  const isSunday = getDayOfWeek(temp) === 0;

  // 🔥 FIX: if previous day is working Saturday → skip Sunday
  const prevDay = new Date(temp);
  prevDay.setDate(prevDay.getDate() - 1);

  const isPrevWorkingSaturday =
    getDayOfWeek(prevDay) === 6 &&
    !isNthSaturdayOff(prevDay, weeklyOffData);
    //!isNthSaturdayOff(prevDay);

  if (isSunday && isPrevWorkingSaturday) {
    temp.setDate(temp.getDate() + 1);
    continue; // ❌ skip Sunday sandwich
  }

  if (!isOffDay(temp, holidays, weeklyOffData)) {
    allOff = false;
    break;
  }

  gapDays++;
  temp.setDate(temp.getDate() + 1);
}
  return allOff ? gapDays : 0;
}

function getSurroundingOffDays(
  start,
  end,
  holidays,
  weeklyOffData
) {

  let extra = 0;

  // =========================
  // BACKWARD
  // =========================

  let temp = new Date(start);

  temp.setDate(temp.getDate() - 1);

  while (
    isOffDay(
      temp,
      holidays,
      weeklyOffData
    )
  ) {

    extra++;

    temp.setDate(temp.getDate() - 1);
  }

  // =========================
  // FORWARD
  // ONLY HOLIDAYS
  // =========================

  temp = new Date(end);

  temp.setDate(temp.getDate() + 1);

  while (
    holidays.some(
      h =>
        formatDateLocal(h.date) ===
        formatDateLocal(temp)
    )
  ) {

    extra++;

    temp.setDate(temp.getDate() + 1);
  }

  return extra;
}

// 🔹 Get adjacent leaves
async function getAdjacentLeaves(
  employeeId,
  start,
  end,
  leaveType,
  includePending = false
) {

  const statusFilter = includePending
    ? { $in: ["pending", "approved"] }
    : "approved";

  // :fire: only nearby previous leave
  const prev = await Leave.findOne({
    employee: employeeId,
    leaveType,
    status: statusFilter,

    dateTo: {
      $gte: new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000),
      $lt: start
    }

  }).sort({ dateTo: -1 });

  // :fire: only nearby next leave
  const next = await Leave.findOne({
    employee: employeeId,
    leaveType,
    status: statusFilter,

    dateFrom: {
      $lte: new Date(end.getTime() + 7 * 24 * 60 * 60 * 1000),
      $gt: end
    }

  }).sort({ dateFrom: 1 });

  return { prev, next };
}

async function simulateLeaveChain(
  employeeId,
  newLeave,
  holidays,
  weeklyOffData
) {

  const approvedLeaves =
    await Leave.find({
      employee: employeeId,
      status: "approved"
    }).sort({ dateFrom: 1 });

  // add temporary leave
  const allLeaves = [

    ...approvedLeaves.map(l => ({
      ...l.toObject(),
      temp: false
    })),

    {
      ...newLeave,
      temp: true
    }
  ];

  allLeaves.sort(
    (a, b) =>
      new Date(a.dateFrom) -
      new Date(b.dateFrom)
  );

  let chain = [allLeaves[0]];

  for (let i = 1; i < allLeaves.length; i++) {

    const prev =
      chain[chain.length - 1];

    const current =
      allLeaves[i];

    let temp =
      new Date(prev.dateTo);

    temp.setDate(temp.getDate() + 1);

    let connected = true;

    while (
      temp < new Date(current.dateFrom)
    ) {

      if (
        !isOffDay(
          temp,
          holidays,
          weeklyOffData
        )
      ) {

        connected = false;
        break;
      }

      temp.setDate(temp.getDate() + 1);
    }

    if (connected) {

      chain.push(current);

    } else {

      const result =
        simulateSaveChain(
          chain,
          holidays,
          weeklyOffData
        );

      const preview =
        result.find(r => r.temp);

      if (preview)
        return preview;

      chain = [current];
    }
  }

  const result =
    simulateSaveChain(
      chain,
      holidays,
      weeklyOffData
    );

  return result.find(r => r.temp);
}

function simulateSaveChain(
  chain,
  holidays,
  weeklyOffData
) {

  if (!chain.length) return [];

  const first = chain[0];

  let start =
    new Date(first.dateFrom);

  let end =
    new Date(
      chain[
        chain.length - 1
      ].dateTo
    );

  // =========================
  // MULTIPLE LEAVE CHAIN
  // =========================

  if (chain.length > 1) {

    let temp = new Date(end);

    temp.setDate(temp.getDate() + 1);

    while (
      isOffDay(
        temp,
        holidays,
        weeklyOffData
      )
    ) {

      end = new Date(temp);

      temp.setDate(temp.getDate() + 1);
    }
  }

  // =========================
  // SINGLE LEAVE CASE
  // =========================

  else {

    let before = new Date(start);

    before.setDate(
      before.getDate() - 1
    );

    let after = new Date(end);

    after.setDate(
      after.getDate() + 1
    );

    const beforeOff =
      isOffDay(
        before,
        holidays,
        weeklyOffData
      );

    const afterOff =
      isOffDay(
        after,
        holidays,
        weeklyOffData
      );

    if (beforeOff && afterOff) {

      while (
        isOffDay(
          before,
          holidays,
          weeklyOffData
        )
      ) {

        start = new Date(before);

        before.setDate(
          before.getDate() - 1
        );
      }

      while (
        isOffDay(
          after,
          holidays,
          weeklyOffData
        )
      ) {

        end = new Date(after);

        after.setDate(
          after.getDate() + 1
        );
      }
    }
  }

  // =========================
  // FINAL TOTAL
  // =========================

  const totalDays =
    Math.ceil(
      (
        end - start
      ) /
      (1000 * 60 * 60 * 24)
    ) + 1;

  // =========================
  // RETURN PREVIEW
  // =========================

  return chain.map(
    (leave, index) => {

      const actualDays =
        calculateBaseDays(
          new Date(
            leave.dateFrom
          ),
          new Date(
            leave.dateTo
          ),
          leave.duration
        );

      return {

        temp: leave.temp,

        isMerged:
          index !== 0,

        isSandwich:
          totalDays >
          actualDays,

        actualDays,

        sandwichDays:
          totalDays - chain.length,

        // totalDays:
        //   index === 0
        //     ? totalDays
        //     : 0
        totalDays:
          leave.temp
          ? totalDays
          : (
          index === 0
            ? totalDays
            : 0
          ),
          previousApprovedLeave: chain.length - 1,

          newAdditionalDeduction:
            totalDays -
            (chain.length - 1)
      };
    }
  );
}

async function rebuildLeaveChain(
  employeeId,
  // leaveType,
  holidays,
  weeklyOffData
) {

  const leaves = await Leave.find({
    employee: employeeId,
    status: "approved"
  }).sort({ dateFrom: 1 });

  if (!leaves.length) return;

  // reset
  for (const l of leaves) {
    l.isMerged = false;
    l.isSandwich = false;
    l.totalDays = calculateBaseDays(
      new Date(l.dateFrom),
      new Date(l.dateTo),
      l.duration
    );
    await l.save();
  }

  let chain = [leaves[0]];

  for (let i = 1; i < leaves.length; i++) {

    const prev =
      chain[chain.length - 1];

    const current =
      leaves[i];

    let temp =
      new Date(prev.dateTo);

    temp.setDate(temp.getDate() + 1);

    let connected = true;

    while (
      temp < new Date(current.dateFrom)
    ) {

      if (
        !isOffDay(
          temp,
          holidays,
          weeklyOffData
        )
      ) {
        connected = false;
        break;
      }

      temp.setDate(temp.getDate() + 1);
    }

    if (connected) {

      chain.push(current);

    } else {

      await saveChain(
        chain,
        holidays,
        weeklyOffData
      );

      chain = [current];
    }
  }

  await saveChain(
    chain,
    holidays,
    weeklyOffData
  );
}

async function saveChain(
  chain,
  holidays,
  weeklyOffData
) {

  if (!chain.length) return;

  const first = chain[0];

  let start =
    new Date(first.dateFrom);

  let end =
    new Date(
      chain[chain.length - 1].dateTo
    );

  // =====================================
  // 🔥 MULTIPLE LEAVE CHAIN
  // leave + weekend + leave
  // =====================================

  if (chain.length > 1) {

    let temp = new Date(end);

    temp.setDate(temp.getDate() + 1);

    // forward holiday extension
    while (
      isOffDay(
        temp,
        holidays,
        weeklyOffData
      )
    ) {

      end = new Date(temp);

      temp.setDate(temp.getDate() + 1);
    }
  }

  // =====================================
  // 🔥 SINGLE LEAVE CASE
  // holiday + leave + holiday
  // =====================================

  else {

    let before = new Date(start);
    before.setDate(before.getDate() - 1);

    let after = new Date(end);
    after.setDate(after.getDate() + 1);

    const beforeOff =
      isOffDay(
        before,
        holidays,
        weeklyOffData
      );

    const afterOff =
      isOffDay(
        after,
        holidays,
        weeklyOffData
      );

    // BOTH SIDES OFF
    if (beforeOff && afterOff) {

      // backward extend
      while (
        isOffDay(
          before,
          holidays,
          weeklyOffData
        )
      ) {

        start = new Date(before);

        before.setDate(
          before.getDate() - 1
        );
      }

      // forward extend
      while (
        isOffDay(
          after,
          holidays,
          weeklyOffData
        )
      ) {

        end = new Date(after);

        after.setDate(
          after.getDate() + 1
        );
      }
    }
  }

  // =====================================
  // 🔥 FINAL TOTAL
  // =====================================

  const totalDays =
    Math.ceil(
      (
        end - start
      ) /
      (1000 * 60 * 60 * 24)
    ) + 1;

  // =====================================
  // 🔥 MASTER LEAVE
  // =====================================

  first.totalDays = totalDays;

  first.isMerged = false;

  first.isSandwich =
    totalDays >
    calculateBaseDays(
      new Date(first.dateFrom),
      new Date(first.dateTo),
      first.duration
    );

  // =====================================
  // 🔥 PAID / LWP
  // =====================================

  const employee =
  await User.findById(first.employee);

let paidDays = 0;
let lwpDays = 0;

if (first.leaveType === "SL") {

  const available =
    employee.sickLeaveBalance +
    (first.paidDays || 0);

  if (available >= totalDays) {

    paidDays = totalDays;

  } else {

    paidDays = available;

    lwpDays =
      totalDays - available;
  }
}

else if (first.leaveType === "CL") {

  const available =
    employee.casualLeaveBalance +
    (first.paidDays || 0);

  if (available >= totalDays) {

    paidDays = totalDays;

  } else {

    paidDays = available;

    lwpDays =
      totalDays - available;
  }
}

else if (first.leaveType === "LWP") {

  lwpDays = totalDays;
}

first.paidDays = paidDays;

first.lwpDays = lwpDays;

  await first.save();

  // =====================================
  // 🔥 MERGED LEAVES
  // =====================================

  for (let i = 1; i < chain.length; i++) {

    chain[i].totalDays = 0;

    chain[i].paidDays = 0;

    chain[i].lwpDays = 0;

    chain[i].isMerged = true;

    //chain[i].isSandwich = true;

    chain[i].isSandwich = false;

    await chain[i].save();
  }
}

// 🔥 Get final day status
const getDayStatus = async (employeeId, date) => {
  const normalized = normalizeDate(date);

  // 1. Check leave
  const leave = await Leave.findOne({
    employee: employeeId,
    status: "approved",
    dateFrom: { $lte: normalized },
    dateTo: { $gte: normalized },
  });

  if (leave) return "LEAVE";

  // 2. Check attendance
  const attendance = await Attendance.findOne({
    employee: employeeId,
    date: normalized,
  });

  if (attendance && attendance.checkIn) return "PRESENT";

  // 3. Otherwise
  return "ABSENT";
};

const formatDateLocal = (date) => {
  const d = normalizeDate(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDayOfWeek = (date) => {
  return normalizeDate(date).getDay(); // 0=Sun, 6=Sat
};

const getSaturdayOfMonth = (date) => {
  const d = normalizeDate(date);
  return Math.ceil(d.getDate() / 7);
};


// const calculateTotalLeaveDays = (
//   start,
//   end,
//   weeklyOffData,
//   duration,
//   holidays = []
// ) => {
//   const startDate = normalizeDate(start);
//   const endDate = normalizeDate(end);
//   console.log("📅 Holidays in backend:", holidays);
//   // 🔹 Safety guard (avoid infinite loop)
//   const MAX_DAYS = 366;

//   const isHoliday = (date) => {
//   const dateStr = formatDateLocal(date);

//   return holidays.some((h) => {
//     const holidayDate =
//       typeof h.date === "string"
//         ? h.date
//         : formatDateLocal(h.date);

//     return holidayDate === dateStr;
//   });
// };

//   const isSunday = (date) => getDayOfWeek(date) === 0;

//   const isNthSaturdayOff = (date) => {
//     if (getDayOfWeek(date) !== 6) return false;

//     const saturdayNumber = getSaturdayOfMonth(date);
//     const offSaturdays = weeklyOffData?.saturdays || [1, 3, 5];

//     return offSaturdays.includes(saturdayNumber);
//   };

//   const isOffDay = (date) =>
//     isSunday(date) || isNthSaturdayOff(date) || isHoliday(date);

  
//   let expandedStart = new Date(startDate);
//   let expandedEnd = new Date(endDate);

//   // 🔹 Expand backward (continuous chain rule)
//   let count = 0;
//   while (count < MAX_DAYS) {
//     const prev = new Date(expandedStart);
//     prev.setDate(prev.getDate() - 1);

//     if (isOffDay(prev)) {
//       expandedStart = prev;
//     } else {
//       break;
//     }
//     count++;
//   }

//   // 🔹 Expand forward
//   count = 0;
//   while (count < MAX_DAYS) {
//     const next = new Date(expandedEnd);
//     next.setDate(next.getDate() + 1);

//     if (isOffDay(next)) {
//       expandedEnd = next;
//     } else {
//       break;
//     }
//     count++;
//   }

//   let totalDays =
//     (normalizeDate(expandedEnd) - normalizeDate(expandedStart)) /
//       (1000 * 60 * 60 * 24) + 1;

//   // 🔹 2nd / 4th Saturday exception
//   const leaveStartsOnSecondOrFourthSaturday =
//     getDayOfWeek(startDate) === 6 &&
//     [2, 4].includes(getSaturdayOfMonth(startDate));

//   if (leaveStartsOnSecondOrFourthSaturday) {
//     const sundayAfterStart = new Date(startDate);
//     sundayAfterStart.setDate(sundayAfterStart.getDate() + 1);

//     if (
//       getDayOfWeek(sundayAfterStart) === 0 &&
//       sundayAfterStart <= expandedEnd
//     ) {
//       totalDays -= 1;
//     }
//   }

//   // 🔹 Half-day override
//   if (duration === "half") {
//     return 0.5;
//   }

//   return totalDays;
// };


// ===============================
// Off-Day Logic
// ===============================

const calculateTotalLeaveDays = (
  start,
  end,
  weeklyOffData,
  duration,
  holidays = []
) => {
  const startDate = normalizeDate(start);
  const endDate = normalizeDate(end);

  const isHoliday = (date) => {
    const dateStr = formatDateLocal(date);
    return holidays.some((h) => {
      const holidayDate =
        typeof h.date === "string" ? h.date : formatDateLocal(h.date);
      return holidayDate === dateStr;
    });
  };

  const isSunday = (date) => getDayOfWeek(date) === 0;

  const isNthSaturdayOff = (date) => {
    if (getDayOfWeek(date) !== 6) return false;
    const saturdayNumber = getSaturdayOfMonth(date);
    const offSaturdays = weeklyOffData?.saturdays || [1, 3, 5];
    return offSaturdays.includes(saturdayNumber);
  };

  const isOffDay = (date) =>
    isSunday(date) || isNthSaturdayOff(date) || isHoliday(date);

  // ✅ Half-day
  if (duration === "half") return 0.5;

  let totalDays = 0;
  let current = new Date(startDate);

  while (current <= endDate) {
    totalDays++;
    current.setDate(current.getDate() + 1);
  }

  
  const isWorkingSaturday =
    getDayOfWeek(startDate) === 6 &&
    !isNthSaturdayOff(startDate);

  if (isWorkingSaturday) {
    const sunday = new Date(startDate);
    sunday.setDate(sunday.getDate() + 1);

    if (
      getDayOfWeek(sunday) === 0 &&
      sunday <= endDate
    ) {
      totalDays -= 1; // ❌ remove Sunday
    }
  }

  const isSecondOrFourthSaturday =
    getDayOfWeek(startDate) === 6 &&
    [2, 4].includes(getSaturdayOfMonth(startDate));

  if (isSecondOrFourthSaturday) {
    const sunday = new Date(startDate);
    sunday.setDate(sunday.getDate() + 1);

    if (getDayOfWeek(sunday) === 0 && sunday <= endDate) {
      totalDays -= 1;
    }
  }

  return totalDays;
};




// ===============================
// Sandwich Leave Logic (HR Policy Based)
// ===============================

async function recalculateEmployeeLeaveBalances(employeeId) {

  const employee =
    await User.findById(employeeId);

  if (!employee) return;

  // =====================================
  // :white_check_mark: ORIGINAL YEARLY ALLOCATION
  // =====================================

  // const TOTAL_SL =
  //   employee.totalSickLeave || 0;

  // const TOTAL_CL =
  //   employee.totalCasualLeave || 0;
  const TOTAL_SL = 4; 
const TOTAL_CL = 17; 

  // =====================================
  // :white_check_mark: ONLY MAIN APPROVED LEAVES
  // =====================================

  const approvedLeaves =
    await Leave.find({
      employee: employeeId,
      status: "approved",
      isMerged: false
    });

  let usedSL = 0;
  let usedCL = 0;
  let usedLWP = 0;

  // =====================================
  // :white_check_mark: CALCULATE USED LEAVES
  // =====================================

  for (const leave of approvedLeaves) {

    // ---------------------------------
    // :white_check_mark: Sick Leave
    // ---------------------------------

    if (leave.leaveType === "SL") {

      usedSL += leave.totalDays || 0;

      usedLWP += leave.lwpDays || 0;
    }

    // ---------------------------------
    // :white_check_mark: Casual Leave
    // ---------------------------------

    else if (leave.leaveType === "CL") {

      usedCL += leave.totalDays  || 0;

      usedLWP += leave.lwpDays || 0;
    }

    // ---------------------------------
    // :white_check_mark: Pure LWP
    // ---------------------------------

    else if (leave.leaveType === "LWP") {

      usedLWP += leave.totalDays || 0;
    }
  }

  // =====================================
  // :white_check_mark: FINAL BALANCES
  // =====================================

  employee.sickLeaveBalance =
    Math.max(0, TOTAL_SL - usedSL);

  employee.casualLeaveBalance =
    Math.max(0, TOTAL_CL - usedCL);

  employee.LwpLeave =
    Math.max(0, usedLWP);

  // =====================================
  // SAVE
  // =====================================

  await employee.save();

  return {
    sickLeaveBalance:
      employee.sickLeaveBalance,

    casualLeaveBalance:
      employee.casualLeaveBalance,

    LwpLeave:
      employee.LwpLeave
  };
}


// 🟢 Main route — approve/reject leave with sandwich logic
app.put("/leave/:leaveId/status", async (req, res) => {
  try {
    const weeklyOffData = await WeeklyOff.findOne({
      year: new Date().getFullYear(),
    });

    // :fire: ALSO ADD HOLIDAYS (you are using it too)
    const holidayDocs = await Holiday.find();

    const holidays = holidayDocs.map(h => ({
      date: h.date
    }));

    const { status, userId, role, actionReason } = req.body;
    const leaveId = req.params.leaveId;

    if (!["approved", "rejected"].includes(status)) {
      
      return res.status(400).json({ error: "Invalid status" });
    }
if (
  (status === "approved" || status === "rejected") &&
  !actionReason?.trim()
) {
  return res.status(400).json({
    error: "Reason is required",
  });
}

if (actionReason && actionReason.trim().length > 200) {
  return res.status(400).json({
    error: "Reason cannot exceed 200 characters",
  });
}
    if (!userId || !["manager", "admin","Team_Leader","hr", "ceo", "coo", "md"].includes(role)) {
      return res.status(400).json({ error: "Invalid userId or role" });
    }

    const leave = await Leave.findById(leaveId).populate("employee");
    if (!leave) return res.status(404).json({ error: "Leave not found" });

    const oldStatus = leave.status;

    const employee = leave.employee;
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    if (role === "manager" && leave.reportingManager?.toString() !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }
    // ============================
// :fire: RESTORE LOGIC (IMPORTANT)
// ============================

// If already approved and now rejecting → restore balance
if (leave.status === "approved" && status === "rejected") {

  // if (leave.leaveType === "SL") {
  //   employee.sickLeaveBalance += leave.paidDays || 0;
  // }

  // if (leave.leaveType === "CL") {
  //   employee.casualLeaveBalance += leave.paidDays || 0;
  // }

  // if (leave.lwpDays) {
  //   employee.LwpLeave = Math.max(0, employee.LwpLeave - leave.lwpDays);
  // }

  // await employee.save();

  // :fire: RE-CALCULATE ADJACENT LEAVES AFTER REJECTION

// const employeeId = leave.employee._id;

  // :fire: FIX ADJACENT LEAVE (REMOVE SANDWICH EFFECT)
//   const { prev, next } = await getAdjacentLeaves(
//     employeeId,
//     new Date(leave.dateFrom),
//     new Date(leave.dateTo),
//     leave.leaveType,
//   );

//   //if (next && next.status === "approved")
//   if (
//   next &&
//   next.status === "approved" &&
//   !next.isMerged
// ) {
//     const recalculated = await calculateWithSandwich(
//   employee._id,
//   new Date(next.dateFrom),
//   new Date(next.dateTo),
//   holidays,
//   weeklyOffData,
//   next.duration,
//   next.leaveType
// );

// next.totalDays = recalculated;
// next.isSandwich = recalculated > calculateBaseDays(
//   new Date(next.dateFrom),
//   new Date(next.dateTo),
//   next.duration
// );

//     // :small_blue_diamond: recalc paid/lwp
//     if (next.leaveType === "SL") {
//       const available = employee.sickLeaveBalance;

//       if (available >= recalculated) {
//         //next.paidDays = newTotal;
//         next.paidDays = recalculated;
//         next.lwpDays = 0;
//       } else {
//         next.paidDays = available;
//         //next.lwpDays = newTotal - available;
//         next.lwpDays = recalculated - available;
//       }
//     }

//     else if (next.leaveType === "CL") {
//       const available = employee.casualLeaveBalance;

//       if (available >= recalculated) {
//         //next.paidDays = newTotal;
//         next.paidDays = recalculated;
//         next.lwpDays = 0;
//       } else {
//         next.paidDays = available;
//         //next.lwpDays = newTotal - available;
//         next.lwpDays = recalculated - available;
//       }
//     }

//     else if (next.leaveType === "LWP") {
//       next.paidDays = 0;
//       //next.lwpDays = newTotal;
//       next.lwpDays = recalculated;
//     }

//     await next.save();
//   }

  //if (prev && prev.status === "approved") 
  // if (
  //   prev &&
  //   prev.status === "approved" &&
  //   !prev.isMerged
  // )
  //{

//   const recalculatedPrev = await calculateWithSandwich(
//   employee._id,
//   new Date(prev.dateFrom),
//   new Date(prev.dateTo),
//   holidays,
//   weeklyOffData,
//   prev.duration,
//   prev.leaveType
// );

// prev.totalDays = recalculatedPrev;
// prev.isSandwich = recalculatedPrev > calculateBaseDays(
//   new Date(prev.dateFrom),
//   new Date(prev.dateTo),
//   prev.duration
// );

// // :small_blue_diamond: recalc paid/lwp for PREV

// if (prev.leaveType === "SL") {

//   const available =
//     employee.sickLeaveBalance;

//   if (available >= recalculatedPrev) {

//     prev.paidDays =
//       recalculatedPrev;

//     prev.lwpDays = 0;

//   } else {

//     prev.paidDays =
//       available;

//     prev.lwpDays =
//       recalculatedPrev - available;
//   }
// }

// else if (prev.leaveType === "CL") {

//   const available =
//     employee.casualLeaveBalance;

//   if (available >= recalculatedPrev) {

//     prev.paidDays =
//       recalculatedPrev;

//     prev.lwpDays = 0;

//   } else {

//     prev.paidDays =
//       available;

//     prev.lwpDays =
//       recalculatedPrev - available;
//   }
// }

// else if (prev.leaveType === "LWP") {

//   prev.paidDays = 0;

//   prev.lwpDays =
//     recalculatedPrev;
// }

//   await prev.save();
//}

leave.status = status;

leave.actionReason = actionReason?.trim();

leave.approvedBy = userId;

leave.approvedByRole = role;

await leave.save();

await rebuildLeaveChain(
  employee._id,
  //leave.leaveType,
  holidays,
  weeklyOffData
);

await recalculateEmployeeLeaveBalances(
  employee._id
);

return res.json({
    message: "Leave rejected successfully",
    leave
  });
}

    // :rotating_light: Prevent double processing
    if (leave.status === "approved" && status === "approved") {
      return res.status(400).json({ error: "Leave already approved" });
    }
// ==============================
// :fire: SANDWICH USING ATTENDANCE
// ==============================

let extraLwpDays = 0;

if (status === "approved" && oldStatus !== "approved") {

  const prevDay = new Date(leave.dateFrom);
  prevDay.setDate(prevDay.getDate() - 1);

  const nextDay = new Date(leave.dateTo);
  nextDay.setDate(nextDay.getDate() + 1);

  const prevStatus = await getDayStatus(employee._id, prevDay);
  const nextStatus = await getDayStatus(employee._id, nextDay);

  let weekendDays = [];
  let temp = new Date(prevDay);

  while (temp <= nextDay) {
    if (getDayOfWeek(temp) === 0 || isOffDay(temp, holidays, weeklyOffData)) {
      weekendDays.push(new Date(temp));
    }
    temp.setDate(temp.getDate() + 1);
  }

  if (weekendDays.length > 0) {

    if (prevStatus === "ABSENT" && nextStatus === "ABSENT") {
      extraLwpDays += weekendDays.length;
    }

    if (prevStatus === "LEAVE" && nextStatus === "ABSENT") {
      extraLwpDays += weekendDays.length;
    }

    if (prevStatus === "ABSENT" && nextStatus === "LEAVE") {
      extraLwpDays += weekendDays.length;
    }
  }
}

if (
  status === "approved" &&
  oldStatus !== "approved"
) {

  // =====================================
  // :fire: STEP 1: SAVE STATUS FIRST
  // =====================================

  leave.status = status;
  leave.actionReason = actionReason?.trim();
  leave.approvedBy = userId;
  leave.approvedByRole = role;

  await leave.save();

  // =====================================
  // :fire: STEP 2: REBUILD GLOBAL CHAIN
  // =====================================

  await rebuildLeaveChain(
    employee._id,
    //leave.leaveType,
    holidays,
    weeklyOffData
  );

  // =====================================
  // :fire: STEP 3: RELOAD UPDATED LEAVE
  // =====================================

  const refreshedLeave =
    await Leave.findById(leave._id);

  // merged leave should not deduct
  // if (refreshedLeave.isMerged) {

  //   return res.json({
  //     message: "Merged leave approved",
  //     leave: refreshedLeave
  //   });
  // }
  if (refreshedLeave.isMerged) {

  refreshedLeave.totalDays = 0;
  refreshedLeave.paidDays = 0;
  refreshedLeave.lwpDays = 0;

  await refreshedLeave.save();
  refreshedLeave.actionReason = actionReason?.trim();

  // :fire: IMPORTANT
  await recalculateEmployeeLeaveBalances(
    employee._id
  );

  leave.isMerged = true;

  leave.totalDays = 0;

  leave.paidDays = 0;

  leave.lwpDays = 0;

  leave.isSandwich =
    refreshedLeave.isSandwich;

  await leave.save();

  return res.json({
    message: "Merged leave approved successfully",
    leave
  });
}

else {

  // =====================================
  // :fire: STEP 4: RELOAD EMPLOYEE
  // =====================================

  const refreshedEmployee =
    await User.findById(employee._id);

  // =====================================
  // :fire: STEP 5: FINAL TOTAL DAYS
  // =====================================

  const totalLeaveDays =
    refreshedLeave.totalDays;

  let paidDays = 0;
  let lwpDays = 0;

  // =====================================
  // :fire: STEP 6: SL
  // =====================================

  if (refreshedLeave.leaveType === "SL") {
    const available = refreshedEmployee.sickLeaveBalance;
    if (available >= totalLeaveDays) {
      paidDays = totalLeaveDays;
      refreshedEmployee.sickLeaveBalance -= totalLeaveDays;
    } else {
      paidDays = available;
      lwpDays = totalLeaveDays - available;
      refreshedEmployee.sickLeaveBalance = 0;
    }
  }

  // =====================================
  // :fire: STEP 7: CL
  // =====================================

  else if (refreshedLeave.leaveType === "CL") {
    const available = refreshedEmployee.casualLeaveBalance;
    if (available >= totalLeaveDays) {
      paidDays = totalLeaveDays;
      refreshedEmployee.casualLeaveBalance -= totalLeaveDays;
    } else {
      paidDays = available;
      lwpDays = totalLeaveDays - available;
      refreshedEmployee.casualLeaveBalance = 0;
    }
  }

  // =====================================
  // :fire: STEP 8: PURE LWP
  // =====================================

  else if (refreshedLeave.leaveType === "LWP") {

    lwpDays = totalLeaveDays;
  }

  // =====================================
  // :fire: STEP 9: SAVE FINAL BREAKDOWN
  // =====================================

  refreshedLeave.paidDays = paidDays;

  if (refreshedLeave.leaveType === "LWP") {

    refreshedLeave.lwpDays =
      lwpDays + extraLwpDays;
  } else {
    refreshedLeave.lwpDays =
      lwpDays;
  }

  await refreshedLeave.save();
  await refreshedEmployee.save();   
  refreshedLeave.actionReason = actionReason?.trim();

  // =====================================
  // :fire: STEP 10: RECALCULATE BALANCE
  // =====================================

  await recalculateEmployeeLeaveBalances(
    employee._id
  );

  leave.totalDays =
    refreshedLeave.totalDays;

  leave.paidDays =
    refreshedLeave.paidDays;

  leave.lwpDays =
    refreshedLeave.lwpDays;

  leave.isMerged =
    refreshedLeave.isMerged;

  leave.isSandwich =
    refreshedLeave.isSandwich;

  await leave.save();
}
}

else {

  leave.status = status;
  leave.actionReason = actionReason?.trim();
  leave.approvedBy = userId;
  leave.approvedByRole = role;

  await leave.save();
}

    // ========== SEND EMAIL TO EMPLOYEE ==========
    const approver = await User.findById(userId).select("role name");
const actualRole = approver ? approver.role : role;
const approverName = approver ? approver.name : userId;

try {
  const statusEmailHtml = await leaveStatusUpdateTemplate(
    employee.name,
    leave.dateFrom,
    leave.dateTo,
    status,
    actionReason || (
      status === "approved"
        ? "Leave approved"
        : "Leave rejected"
    ),
    actualRole,
    approverName 
  );

  await transporter.sendMail({
    from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
    to: employee.email,
    subject: `Leave Request ${status === "approved" ? "Approved" : "Rejected"} - ${leave.leaveType} Leave`,
    html: statusEmailHtml,
  });
  console.log(`email sent to ${employee.email}`);
} catch (emailErr) {
  console.error("Status update email failed:", emailErr.message);
}
// ========== END EMAIL SENDING ==========
    


    let finalRole = role.toUpperCase();
    if (role === "Team_Leader") finalRole = "Team_Leader";
    if (role === "IT_Support") finalRole = "IT_Support";
    
    // 1️⃣ Notify the employee
    await Notification.create({
      user: employee._id,
      type: "Leave",
      message: `Your leave request (${new Date(
        leave.dateFrom
      ).toDateString()} - ${new Date(
        leave.dateTo
      ).toDateString()}) has been ${status}.`,
      leaveRef: leave._id,
      triggeredByRole: finalRole,  
    });

    // 2️⃣ Notify admins/HR/CEO/COO/MD
    const admins = await User.find({
      role: { $in: ["admin", "hr", "ceo", "coo", "md"] },
    });

    for (let admin of admins) {
      await Notification.create({
        user: admin._id,
        type: "Leave",
        message: `${employee.name}'s leave request (${new Date(leave.dateFrom).toDateString()} - ${new Date(leave.dateTo).toDateString()}) has been ${status} by ${role}.`,
        leaveRef: leave._id,
        triggeredByRole: finalRole,  
      });
    }

    //Notify Team Leaders
    const teams = await Team.find({
      assignToProject: { $in: [employee._id] }
    }).populate("teamLead", "_id name role");

    const notifiedTLs = new Set();

    for (const team of teams) {
      if (team.teamLead && team.teamLead.length) {
        for (const tl of team.teamLead) {
          if (tl && tl.role === "Team_Leader" && 
              tl._id.toString() !== userId && 
              !notifiedTLs.has(tl._id.toString())) {
            
            notifiedTLs.add(tl._id.toString());
            
            await Notification.create({
              user: tl._id,
              type: "Leave",
              message: `${employee.name}'s leave request (${new Date(leave.dateFrom).toDateString()} - ${new Date(leave.dateTo).toDateString()}) has been ${status} by ${role}.`,
              leaveRef: leave._id,
              triggeredByRole: finalRole,
              createdAt: new Date()
            });
          }
        }
      }
    }

    // Notify Reporting Manager 
    if (leave.reportingManager && 
        leave.reportingManager.toString() !== userId) {
      await Notification.create({
        user: leave.reportingManager,
        type: "Leave",
        message: `${employee.name}'s leave request (${new Date(leave.dateFrom).toDateString()} - ${new Date(leave.dateTo).toDateString()}) has been ${status} by ${role}.`,
        leaveRef: leave._id,
        triggeredByRole: finalRole,
        createdAt: new Date()
      });
    }


    // ============================
    // :white_check_mark: FINAL RESPONSE
    // ============================
    return res.json({
      message: `Leave ${status} successfully`,
      leave,
      breakdown: {
        totalDays: leave.totalDays,
        paidDays: leave.paidDays || 0,
        lwpDays: leave.lwpDays || 0,
      },
    });

  } catch (err) {
    console.error("Error updating leave status:", err);
    res.status(500).json({ error: err.message });
  }
});



function isDateWithinRegularizationWindow(selectedDate) {
  const selected = new Date(selectedDate);
  selected.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayDate = today.getDate();
  let windowStart;

  if (todayDate <= 5) {
    windowStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  } else {
    windowStart = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  const windowEnd = new Date(today);
  windowEnd.setDate(today.getDate() - 1);
  windowEnd.setHours(23, 59, 59, 999);

  return selected >= windowStart && selected <= windowEnd;
}

app.post("/attendance/regularization/apply", async (req, res) => {
  try {
    const {
      employeeId,
      date,
      requestedCheckIn,
      requestedCheckOut,
      mode,
      reason,
    } = req.body;
    console.log("checkin/checkout:", requestedCheckIn, requestedCheckOut, mode);

    if (!employeeId)
      return res.status(400).json({ error: "Employee ID is required" });
    if (!date) return res.status(400).json({ error: "Date is required" });
    if (!isDateWithinRegularizationWindow(date))
      return res.status(400).json({
        error:
          "You can apply regularization only for past dates within the allowed period.",
      });
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // ✅ Convert plain times to proper UTC times (from IST)
    function toISTDate(dateStr, timeStr) {
      if (!dateStr || !timeStr) return null;
      const [hours, minutes] = timeStr.split(":");
      if (isNaN(hours) || isNaN(minutes)) return null;
      const utcDate = new Date(dateStr);
      utcDate.setUTCHours(hours - 5, minutes - 30, 0, 0); // Convert IST → UTC
      return utcDate;
    }

    const checkInDate = toISTDate(date, requestedCheckIn);
    const checkOutDate = toISTDate(date, requestedCheckOut);

    // Validate
    if (
      !checkInDate ||
      !checkOutDate ||
      isNaN(checkInDate) ||
      isNaN(checkOutDate)
    ) {
      return res
        .status(400)
        .json({ error: "Invalid check-in or check-out time" });
    }
    //Added by Jaicy
    // Validation 1: check-in < check-out
    if (checkInDate >= checkOutDate) {
      return res
        .status(400)
        .json({ error: "Check-in time must be earlier than check-out time" });
    }

    // // Validation 2: both within 9:00 AM – 6:00 PM IST
    // function isWithinWorkingHours(dateObj) {
    //   const hours = dateObj.getHours(); // in UTC, already converted from IST
    //   const minutes = dateObj.getMinutes();
    //   const totalMinutes = hours * 60 + minutes;

    //   const workStart = 9 * 60; // 9:00 AM IST → 3:30 AM UTC
    //   const workEnd = 18 * 60; // 6:00 PM IST → 12:30 PM UTC

    //   return totalMinutes >= workStart && totalMinutes <= workEnd;
    // }

    // if (!isWithinWorkingHours(checkInDate) || !isWithinWorkingHours(checkOutDate)) {
    //   return res.status(400).json({
    //     error: "Check-in and check-out times must be within 9:00 AM to 6:00 PM",
    //   });
    // }
    // Validation 3: Reason ≤ 20 words
    // if (reason) {
    //   const wordCount = reason.trim().split(/\s+/).length;
    //   if (wordCount > 10) {
    //     return res.status(400).json({
    //       error: "Reason cannot exceed 20 words",
    //     });
    //   }
    // }

      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

      const monthlyRegularizationCount = await Attendance.countDocuments({
        employee: employeeId,
        date: {
          $gte: startOfMonth,
          $lte: endOfMonth,
        },
        "regularizationRequest.status": {
          $in: ["Pending", "Approved"],
        },
      });

      if (monthlyRegularizationCount >= 3) {
        return res.status(400).json({
          error: "You can submit only 3 regularization requests in a month",
        });
      }
    
    const employee = await User.findById(employeeId);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const managerId = employee.reportingManager;
    console.log("managerId:", managerId);

    const attendance = await Attendance.findOneAndUpdate(
      { employee: employeeId, date: targetDate },
      {
        $setOnInsert: {
          employee: employeeId,
          date: targetDate,
          dayStatus: "Absent",
        },
        $set: {
          mode: mode || "Office",
          regularizationRequest: {
            checkIn: checkInDate,
            checkOut: checkOutDate,
            status: "Pending",
            reason: reason,
            requestedAt: new Date(),
            reportingManager: managerId,
          },
        },
      },
      { new: true, upsert: true },
    );

    // send email templete
    try {
      const regularizationHtml = await regularizationApplicationTemplate(
        employee.name,
        employee.employeeId,
        employee.designation || 'N/A',
        employee.department || 'N/A',
        date,
        requestedCheckIn,
        requestedCheckOut,
        mode,
        reason,
        employee.email,
      );
    
      let reportingManagerEmail = null;
      if (managerId) {
        const manager = await User.findById(managerId).select("email");
        if (manager && manager.email) {
          reportingManagerEmail = manager.email;
        }
      }
    
      const ccRoles = ["admin", "hr", "ceo", "md", "coo"];
      const ccUsers = await User.find({ 
        role: { $in: ccRoles },
        isDeleted: { $ne: true },
        email: { $exists: true, $ne: null }
      }).select("email");
    
      const ccEmails = ccUsers.map(u => u.email);
    
      const teams = await Team.find({
        assignToProject: { $in: [employeeId] }
      }).populate("teamLead", "email role");
    
      const tlEmails = new Set();
      teams.forEach(team => {
        if (team.teamLead && team.teamLead.length) {
          team.teamLead.forEach(tl => {
            if (tl && tl.role === "Team_Leader" && tl.email) {
              tlEmails.add(tl.email);
            }
          });
        }
      });
    
      const allCcEmails = [...ccEmails, ...tlEmails];
    
      if (reportingManagerEmail) {
        await transporter.sendMail({
          from: `"${employee.name}" <${employee.email}>`,
          to: reportingManagerEmail,
          cc: allCcEmails.join(','),
          subject: `Attendance Regularization Request - ${employee.name} (${employee.employeeId})`,
          html: regularizationHtml,
        });
        console.log(`Regularization email sent to Manager: ${reportingManagerEmail}, CC: ${allCcEmails.length} recipients`);
      } else if (allCcEmails.length > 0) {
        await transporter.sendMail({
          from: `"${employee.name}" <${employee.email}>`,
          to: allCcEmails[0],
          cc: allCcEmails.slice(1).join(','),
          subject: `Attendance Regularization Request - ${employee.name} (${employee.employeeId})`,
          html: regularizationHtml,
        });
        console.log(`Regularization email sent , CC: ${allCcEmails.length} recipients`);
      }
    } catch (emailErr) {
      console.error("Email sending failed for regularization:", emailErr.message);
    }
    
    // send email templete code end 

    const teams = await Team.find({
      assignToProject: { $in: [employeeId] }
    }).populate("teamLead", "_id name role");

    const notifiedTLs = new Set();

    teams.forEach(team => {
      if (team.teamLead && team.teamLead.length) {
        team.teamLead.forEach(tl => {
          if (tl && tl.role === "Team_Leader" && tl._id.toString() !== employeeId && !notifiedTLs.has(tl._id.toString())) {
            notifiedTLs.add(tl._id.toString());
            console.log(` ${tl.name}`);
            
            // Send noti to tl
            Notification.create({
              user: tl._id,
              type: "Regularization",
              message: `New regularization request from ${employee.name} for ${targetDate.toDateString()}`,
              regularizationRef: attendance._id,
              triggeredByRole: employee.role?.toUpperCase() || "EMPLOYEE",
            });
          }
        });
      }
    });

    // Notify manager + admins
    if (managerId) {
      await Notification.create({
        user: managerId,
        type: "Regularization",
        message: `New regularization request from ${
          employee.name
        } for ${targetDate.toDateString()}`,
        regularizationRef: attendance._id,
        triggeredByRole: "EMPLOYEE",
      });
    }

    const admins = await User.find({
      role: { $in: ["admin", "hr", "ceo", "coo", "md"] },
    });
    for (const admin of admins) {
      if (admin._id.toString() === employeeId.toString()) continue;//rutuja 07-04-26
      await Notification.create({
        user: admin._id,
        type: "Regularization",
        message: `New regularization request from ${
          employee.name
        } for ${targetDate.toDateString()}`,
        regularizationRef: attendance._id,
        triggeredByRole: "HR",
      });
    }

    res.json({ message: "Regularization request submitted", attendance });
  } catch (err) {
    console.error("Error applying regularization:", err);
    res.status(500).json({ error: err.message });
  }
});

//get all reqularization req assign to tl (26-03-2026)
app.get("/regularization/team-leader/:teamLeadId", async (req, res) => {
  try {
    const { teamLeadId } = req.params;

    const teams = await Team.find({ teamLead: teamLeadId })
      .populate("assignToProject", "_id");

    if (!teams || teams.length === 0) {
      return res.status(200).json({
        success: true,
        requests: []
      });
    }

    const memberIds = [];
    teams.forEach(team => {
      if (team.assignToProject && Array.isArray(team.assignToProject)) {
        team.assignToProject.forEach(member => {
          if (member && member._id && member._id.toString() !== teamLeadId) {
            memberIds.push(member._id.toString());
          }
        });
      }
    });

    if (memberIds.length === 0) {
      return res.status(200).json({
        success: true,
        requests: []
      });
    }

    const requests = await Attendance.find({
      employee: { $in: memberIds },
      "regularizationRequest": { $exists: true }
    })
      .populate("employee", "name email employeeId designation")
      .populate("regularizationRequest.approvedBy", "name role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      requests: requests
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

//rutuja api to get availabe emp under manager 26-03-2026
app.get("/manager/:managerId/available-employees", authenticate, async (req, res) => {
  try {
    const { managerId } = req.params;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); 

    const employees = await User.find(
      { 
        reportingManager: managerId,
        isDeleted: false,
        role: "employee" 
      },
      {
        _id: 1,
        name: 1,
        email: 1,
        employeeId: 1,
        designation: 1,
        image: 1,
        contact: 1,
        doj: 1,
        department: 1
      }
    ).sort({ name: 1 });

    if (!employees || employees.length === 0) {
      return res.json({
        success: true,
        availableEmployees: [],
        summary: {
          totalEmployees: 0,
          availableToday: 0,
          busyToday: 0,
          date: today.toISOString().split('T')[0] 
        }
      });
    }

    const employeeIds = employees.map(emp => emp._id);

    const tasksToday = await Task.find({
      assignedTo: { $in: employeeIds },
      dateOfTaskAssignment: { 
        $gte: today, 
        $lt: tomorrow 
      }
    }).populate("assignedTo", "name employeeId")
      .select("taskName projectName assignedTo dateOfTaskAssignment");

    const busyEmployeeIds = new Set();
    tasksToday.forEach(task => {
      if (task.assignedTo && task.assignedTo._id) {
        busyEmployeeIds.add(task.assignedTo._id.toString());
      }
    });

    const availableEmployees = employees.filter(
      emp => !busyEmployeeIds.has(emp._id.toString())
    );

    const busyEmployees = employees.filter(
      emp => busyEmployeeIds.has(emp._id.toString())
    );


    res.json({
      success: true,
      availableEmployees: availableEmployees,
      busyEmployees: busyEmployees,
      summary: {
        totalEmployees: employees.length,
        availableToday: availableEmployees.length,
        busyToday: busyEmployees.length,
        date: today.toISOString().split('T')[0] 
      }
    });

  } catch (error) {
    console.error("Error fetching available employees:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});



// Get all regularization requests for a manager
// Get all regularization requests assigned to a manager
// GET regularization requests for manager
app.get("/regularization/manager/:managerId", async (req, res) => {
  const { managerId } = req.params;

  try {
    // Find all attendance records where employee's reportingManager is this manager
    const records = await Attendance.find({
      "regularizationRequest.status": {
        $in: ["Pending", "Approved", "Rejected"],
      },
    }).populate({
      path: "employee",
      match: { reportingManager: managerId }, // Only employees reporting to this manager
    });

    // Filter out null employees (not reporting to this manager)
    const filteredRecords = records.filter((r) => r.employee);

    res.json(filteredRecords);
  } catch (err) {
    console.error("Error fetching regularization for manager:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Get My Regularization Requests (Employee) with employee name
app.get("/attendance/regularization/my/:employeeId", async (req, res) => {
  try {
    const employeeId = req.params.employeeId;

    // Find all attendance documents for this employee where regularizationRequest exists
    const requests = await Attendance.find({
      employee: employeeId,
      regularizationRequest: { $exists: true, $ne: {} },
    })
      .sort({ date: -1 }) // most recent first
      .populate("employee", "name"); // populate only the 'name' field

    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get all regularizations for all employees
app.get("/attendance/regularization/all", authenticate, async (req, res) => {
  try {
    const records = await Attendance.find({
      regularizationRequest: { $exists: true, $ne: null },
    })
      .populate("employee", "name email employeeId") // fetch employee details
      .sort({ date: -1 });

    res.json(records);
  } catch (err) {
    console.error("Fetch all regularizations error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//get all leave and regularization to admin
app.get("/leaves-and-regularizations", authenticate, async (req, res) => {
  try {
    // Only admin can access
    if (
      req.user.role !== "admin" &&
      req.user.role !== "ceo" &&
      req.user.role !== "hr" &&
      req.user.role !== "coo" &&
      req.user.role !== "md"
    ) {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    // ✅ Fetch all leaves
    const leaves = await Leave.find()
      .populate("employee", "name email employeeId department")
      .sort({ fromDate: -1 });

    // ✅ Fetch all regularizations
    const regularizations = await Attendance.find({
      regularizationRequest: { $exists: true, $ne: null },
    })
      .populate("employee", "name email employeeId department")
      .sort({ date: -1 });

    // ✅ Return both in single response
    res.json({
      leaves,
      regularizations,
    });
  } catch (err) {
    console.error("Error fetching leaves & regularizations:", err);
    res.status(500).json({ error: err.message });
  }
});

// Approve / Reject Regularization=admin
app.put(
  "/attendance/regularization/:id/status",
  authenticate,
  async (req, res) => {
    try {
     const { status, actionReason } = req.body; // "Approved" or "Rejected"
      const { id } = req.params;

      if (!["Approved", "Rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }
if (
  (status === "Approved" ||
    status === "Rejected") &&
  !actionReason?.trim()
) {
  return res.status(400).json({
    error: "Reason is required",
  });
}

if (
  actionReason &&
  actionReason.trim().length > 200
) {
  return res.status(400).json({
    error: "Reason cannot exceed 200 characters",
  });
}
      const record = await Attendance.findById(id).populate("employee", "name role email"); //rutuja 07-04-26

      if (!record) {
        return res.status(404).json({ message: "Attendance record not found" });
      }

      if (!record.regularizationRequest) {
        return res
          .status(400)
          .json({ message: "No regularization request found" });
      }

      //rutuja 07-04-26
      const approver = await User.findById(req.user._id).select("name role");

      let approvedRole =
      req.user.role === "Team_Leader"
        ? "Team_Leader"
        : req.user.role.toLowerCase();

      record.regularizationRequest.status = status;
      record.regularizationRequest.actionReason =
  actionReason?.trim();
    record.regularizationRequest.reviewedAt = new Date();
    record.regularizationRequest.approvedBy = req.user._id;
    record.regularizationRequest.approvedByRole = approvedRole;
    record.regularizationRequest.approvedByName = approver.name;
      //rutuja 07-04-26
      // Update status
      // record.regularizationRequest.status = status;

      // If Approved → mark as Present and recalculate working hours
      if (status === "Approved") {
        record.checkIn = record.regularizationRequest.checkIn;
        record.checkOut = record.regularizationRequest.checkOut;

        const diffMs = record.checkOut - record.checkIn;
        record.workingHours = diffMs / (1000 * 60 * 60);

        record.dayStatus = record.workingHours >= 7.5 ? "Present" : "Half Day";
      }

      // If Rejected → mark as Absent
      if (status === "Rejected") {
        record.dayStatus = "Absent";
      }

      await record.save();

      //email code start
      try {
        const statusEmailHtml = await regularizationStatusUpdateTemplate(
          record.employee.name,
          record.date,
          record.regularizationRequest.checkIn,
          record.regularizationRequest.checkOut,
          status,
          actionReason || (status === "Approved" ? "Regularization approved" : "Regularization rejected"),
          approvedRole,
          approver.name
        );
  
        await transporter.sendMail({
          from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
          to: record.employee.email,
          subject: `Regularization Request ${status === "Approved" ? "Approved" : "Rejected"} - ${new Date(record.date).toDateString()}`,
          html: statusEmailHtml,
        });
        console.log(`Regularization status email sent to ${record.employee.email}`);
      } catch (emailErr) {
        console.error("Regularization status update email failed:", emailErr.message);
      }
      // email code end

      //rutuja 07-04-26
      const finalRole = req.user.role === "Team_Leader" ? "Team_Leader" : req.user.role.toUpperCase();

      // 1️⃣ Notify employee
      await Notification.create({
        user: record.employee._id,
        type: "Regularization",
        message: `Your regularization request for ${record.date.toDateString()} has been ${status} by ${approver.name} (${approver.role}).`, //rutuja 07-04-26
        regularizationRef: record._id,
        triggeredByRole: finalRole, //rutuja 07-04-26
      });

      // 2️⃣ Notify admin(s)
      const admins = await User.find({
        role: { $in: ["admin", "hr", "ceo", "coo", "md"] },
      });
      for (let admin of admins) {
        if (admin._id.toString() === req.user._id.toString()) continue;
        if (record.employee.role === "hr" && admin.role === "hr") continue;//rutuja 07-04-26
        await Notification.create({
          user: admin._id,
          type: "Regularization",
          message: `${
            record.employee.name
          }'s regularization request for ${record.date.toDateString()} has been ${status}.`,
          regularizationRef: record._id,
          triggeredByRole: finalRole, //rutuja 07-04-26
        });
      }

      res.json({ message: `Regularization ${status}`, record });
    } catch (err) {
      console.error("Update regularization error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// DELETE regularization request=admin can delete
// DELETE regularization request=admin can delete
app.delete("/attendance/regularization/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const attendance = await Attendance.findByIdAndDelete(id);
    if (!attendance)
      return res.status(404).json({ error: "Attendance not found" });

    // ✅ Delete related notifications
    await Notification.deleteMany({
      regularizationRef: attendance._id,
    });
    res
      .status(200)
      .json({ message: "Regularization request deleted successfully" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: "Failed to delete request" });
  }
});

//my attendane
app.get("/attendance/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    const records = await Attendance.find({ employee: employeeId })
      .populate("employee", "name email employeeId department") // employee details
      .populate("leaveRef", "leaveType duration status appliedAt approvedBy") // leave details
      .sort({ date: -1 }); // latest first

    res.status(200).json(records);
  } catch (err) {
    console.error("Error fetching attendance:", err);
    res.status(500).json({ error: err.message });
  }
});

const Event = require("./models/EventSchema");
// Add new holiday
app.post("/addEvent", async (req, res) => {
  try {
    const { name, date, description } = req.body;
    console.log(req.body);
    const event = new Event({ name, date, description });

    await event.save();
    // 2️⃣ Fetch all users (employee, manager, hr, admin)
   const users = await User.find({ role: { $ne: "admin" } }); // fetch all users

    // 3️⃣ Create notifications for all users
    const notifications = users.map((user) => ({
      user: user._id,
      type: "Event",
      message: `New event "${name}" scheduled on ${new Date(
        date,
      ).toDateString()}`,
      eventRef: event._id,
    }));

    await Notification.insertMany(notifications);

    res.status(201).json({
      event,
      message: "Event created and notifications sent to all employees.",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create holiday" });
  }
});

//admin can delete events
// Delete holiday
app.delete("/events/:id", async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Event deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete Event" });
    console.log(err);
  }
});

// Get all events for employee, including birthdays, anniversaries, and custom events
app.get("/events-for-employee", authenticate, async (req, res) => {
  try {
    const today = new Date();

    // Employee birthdays & anniversaries
    const employees = await User.find({}, "name dob doj");
    const employeeEvents = employees
      .map((emp) => {
        const dob = new Date(emp.dob);
        let nextBirthday = new Date(
          today.getFullYear(),
          dob.getMonth(),
          dob.getDate(),
        );
        if (nextBirthday < today)
          nextBirthday.setFullYear(today.getFullYear() + 1);

        const doj = new Date(emp.doj);
        let nextAnniversary = new Date(
          today.getFullYear(),
          doj.getMonth(),
          doj.getDate(),
        );
        if (nextAnniversary < today)
          nextAnniversary.setFullYear(today.getFullYear() + 1);

        return [
          { type: "Birthday", name: emp.name, date: nextBirthday },
          { type: "Anniversary", name: emp.name, date: nextAnniversary },
        ];
      })
      .flat();

    // Custom events from Event collection
    const customEvents = await Event.find({}, "name date description _id").sort(
      { date: 1 },
    );
    const mappedCustomEvents = customEvents.map((ev) => ({
      _id: ev._id,
      type: "Event",
      name: ev.name,
      date: new Date(ev.date),
      description: ev.description || "",
    }));

    // Combine all events and sort by date
    const allEvents = [...employeeEvents, ...mappedCustomEvents].sort(
      (a, b) => a.date - b.date,
    );

    res.json(allEvents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch events." });
  }
});
//snehal code edit
// Admin can update event
app.put("/events/:id", authenticate, async (req, res) => {
  try {
    const { name, date } = req.body;

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      {
        name,
        date,
      },
      { new: true }, // return updated document
    );

    if (!updatedEvent) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json({
      message: "Event updated successfully",
      event: updatedEvent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update event" });
  }
});
//snehal code edit
//assign reporting manager
// GET all users with role 'manager'
app.get("/managers", async (req, res) => {
  try {
    const managers = await User.find({ role: "manager" }).select(
      "_id name email designation profile department",
    );
    res.status(200).json(managers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch managers" });
  }
});

// Assign reporting manager
// Assign reporting manager
// Assign reporting manager
// app.put("/users/:employeeId/assign-manager", async (req, res) => {
//   try {
//     const { employeeId } = req.params;
//     const { managerId } = req.body; // should be just the manager's _id

//     if (!managerId) {
//       return res.status(400).json({ error: "Manager ID is required" });
//     }

//     const manager = await User.findById(managerId);
//     if (!manager) {
//       return res.status(404).json({ error: "Manager not found" });
//     }

//     // const employee = await User.findByIdAndUpdate(
//     //   employeeId,
//     //   { reportingManager: manager._id },
//     //   { new: true }
//     // ).populate("reportingManager", "_id name email designation role department profile"); // optional populate
// await User.findByIdAndUpdate(employeeId, { reportingManager: manager._id });

// const employee = await User.findById(employeeId)
//   .populate("reportingManager", "name email contact designation role department profile");

//     res.status(200).json({ message: "Manager assigned successfully", employee });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Server error" });
//   }
// });
// //get manager employee data
// app.get("/employees/:id", async (req, res) => {
//   try {
//     const user = await User.findById(req.params.id).populate(
//       "reportingManager",
//       "_id name email designation role department"
//     );

//     if (!user) return res.status(404).json({ error: "User not found" });
//     res.json(user);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

app.put("/users/:employeeId/assign-manager", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { managerId } = req.body;

    if (!managerId) {
      return res.status(400).json({ error: "Manager ID is required" });
    }

    // check if manager exists
    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ error: "Manager not found" });
    }

    // assign manager
    await User.findByIdAndUpdate(employeeId, { reportingManager: manager._id });

    // fetch employee with populated manager info
    const employee = await User.findById(employeeId).populate(
      "reportingManager",
      "_id name email contact designation role department image employeeId",
    );

    res
      .status(200)
      .json({ message: "Manager assigned successfully", employee });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/getAllEmployeeAndTheirManager", async (req, res) => {
  try {
    const employees = await User.find(
      {},
      {
        name: 1,
        employeeId: 1,
        reportingManager: 1,
      },
    ).populate("reportingManager", "name email designation employeeId");
    // Populate only selected fields

    res.status(200).json({
      success: true,
      employees,
    });
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employees and managers",
    });
  }
});

//assign MD to manager
app.put("/assignMd/:managerId", async (req, res) => {
  try {
    const { managerId } = req.params;
    const { mdId } = req.body;

    if (!mdId) {
      return res.status(400).json({ error: "MD ID is required" });
    }

    const md = await User.findById(mdId);
    if (!md) {
      return res.status(404).json({ error: "MD not found" });
    }

    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ error: "Manager not found" });
    }

    await User.findByIdAndUpdate(managerId, { reportingManager: md._id });

    const updatedManager = await User.findById(managerId).populate(
      "reportingManager",
      "_id name email contact designation role department image employeeId",
    );

    res.status(200).json({ 
      message: "MD assigned successfully", 
      manager: updatedManager 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/employees/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate(
      "reportingManager",
      "_id name email contact designation role department image employeeId",
    );

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/employees/name/:name", async (req, res) => {
  try {
    const user = await User.findOne({ name: req.params.name }).populate(
      "reportingManager",
      "_id name email contact designation role department image employeeId",
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/leaves/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    const records = await Attendance.find({ employee: employeeId })
      .populate("leaveRef") // populate leave details
      .sort({ date: 1 });

    res.json(records);
  } catch (err) {
    console.error("Error fetching attendance:", err);
    res.status(500).json({ error: "Server error" });
  }
});

//delete leave/withdraw leave
app.delete("/leave/:id", async (req, res) => {
  try {
    const leaveId = req.params.id;

    // 1️⃣ Find leave first
    const leave = await Leave.findById(leaveId);
    if (!leave) {
      return res.status(404).json({ error: "Leave not found" });
    }

    // 2️⃣ Delete related notifications
    await Notification.deleteMany({ leaveRef: leaveId });

    // 3️⃣ Delete leave
    await Leave.findByIdAndDelete(leaveId);

    res.json({
      message: "Leave and related notifications deleted successfully",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const Holiday = require("./models/HolidaysSchema");
//holidays calender
// Get all holidays
app.get("/getHolidays", async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.json(holidays);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch holidays" });
  }
});

// Add new holiday
app.post("/holidays", async (req, res) => {
  try {
    const { name, date, description } = req.body;
    //  Check if holiday already exists on same date
    const existingHoliday = await Holiday.findOne({
      date: new Date(date),
    });

    if (existingHoliday) {
      return res.status(400).json({
        message: "Holiday already exists on this date.",
      });
    }
    console.log(req.body);

    const holiday = new Holiday({ name, date, description });
    await holiday.save();

    // notification code added by rutuja
    const users = await User.find({ role: { $ne: "admin" } });

    const notifications = users.map((user) => ({
      user: user._id,
      type: "Holiday",
      message: `New Holiday "${name}" scheduled on ${new Date(
        date,
      ).toDateString()}`,
      holidayRef: holiday._id,
    }));

    await Notification.insertMany(notifications);
    // end

    res.status(201).json(holiday);
  } catch (err) {
    res.status(500).json({ error: "Failed to create holiday" });
  }
});

// Delete holiday
app.delete("/holidays/:id", async (req, res) => {
  try {
    await Holiday.findByIdAndDelete(req.params.id);
    res.json({ message: "Holiday deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete holiday" });
  }
});

// Update Holiday
app.put("/holidays/:id", authenticate, async (req, res) => {
  try {
    const { name, date } = req.body;

    const updatedHoliday = await Holiday.findByIdAndUpdate(
      req.params.id,
      { name, date },
      { new: true },
    );

    if (!updatedHoliday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    // Send update notification
    const users = await User.find({ role: { $ne: "admin" } });
    const role = req.user.role; // from authenticate middleware
    const uppercaseRole = role.toUpperCase();
    const notifications = users.map((user) => ({
      user: user._id,
      type: "Holiday Update",
      message: `Holiday "${name}" has been updated to ${new Date(
        date,
      ).toDateString()}`,
      holidayRef: updatedHoliday._id,
      triggeredByRole: uppercaseRole,
    }));

    await Notification.insertMany(notifications);

    res.json({
      message: "Holiday updated successfully",
      holiday: updatedHoliday,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update holiday" });
  }
});

// //weekly off
// const WeeklyOff = require("./models/WeeklyOffSchema");

// app.post("/admin/weeklyoff", async (req, res) => {
//   const { year, saturdays } = req.body;

//   try {
//     // Update if exists, otherwise create
//     const updated = await WeeklyOff.findOneAndUpdate(
//       { year },
//       { saturdays },
//       { upsert: true, new: true }
//     );

//     res.status(201).json({
//       status: 201,
//       message: "Weekly off updated successfully",
//       data: updated
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ status: 500, message: "Something went wrong" });
//   }
// });
// app.get("/admin/weeklyoff/:year", async (req, res) => {
//   const { year } = req.params;
//   try {
//     const config = await WeeklyOff.findOne({ year: parseInt(year) });
//     res.status(200).json({ status: 200, data: config || { saturdays: [] } });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ status: 500, message: "Something went wrong" });
//   }
// });

const WeeklyOff = require("./models/WeeklyOffSchema");
const Policy = require("./models/PolicySchema");

// Save or update weekly off config
app.post("/admin/weeklyoff", async (req, res) => {
  const { year, saturdays } = req.body;
  console.log("teat sat", year, saturdays);

  try {
    if (!year || !Array.isArray(saturdays)) {
      return res.status(400).json({ message: "Invalid input format" });
    }

    const updated = await WeeklyOff.findOneAndUpdate(
      { year },
      { saturdays },
      { upsert: true, new: true },
    );

    res.status(201).json({
      success: true,
      message: "Weekly off updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error saving weekly off:", err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// Get weekly off for a given year
app.get("/admin/weeklyoff/:year", async (req, res) => {
  const { year } = req.params;

  try {
    const config = await WeeklyOff.findOne({ year: parseInt(year) });
    res.status(200).json({
      success: true,
      data: config || { saturdays: [] },
    });
  } catch (err) {
    console.error("Error fetching weekly off:", err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

app.get("/notifications/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    let notifications = [];

    if (
      user.role === "manager" ||
      user.role === "admin" ||
      user.role === "hr" ||
      user.role === "ceo" ||
      user.role === "coo" ||
      user.role === "md" ||
      user.role === "Team_Leader"
    ) {
      // HR, Manager, Admin → fetch all notifications
      notifications = await Notification.find({})
        .populate("leaveRef", "leaveType dateFrom dateTo status")
        .populate("regularizationRef", "date regularizationRequest.status")
        .populate("eventRef", "name date description")
        .sort({ createdAt: -1 });
    } else {
      // Employees → only their own notifications
      notifications = await Notification.find({ user: req.params.userId })
        .populate("leaveRef", "leaveType dateFrom dateTo status")
        .populate("regularizationRef", "date regularizationRequest.status")
        .populate("eventRef", "name date description")
        .sort({ createdAt: -1 });
    }

    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// GET single employee
app.get("/getEmployee/:id", async (req, res) => {
  try {
    const employee = await User.findById(req.params.id).populate(
      "reportingManager",
      "name email designation",
    );
    if (!employee)
      return res.status(404).json({ message: "Employee not found" });
    res.json(employee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/attendance/employee/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const attendanceRecords = await Attendance.find({ employee: id }).sort({
      date: -1,
    });
    res.json(attendanceRecords);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch employee attendance" });
  }
});

// ✅ Get all attendance records of a particular employee
// app.get("/attendance/all/:employeeId", async (req, res) => {
//   try {
//     const { employeeId } = req.params;

//     // Validate ObjectId
//     if (!employeeId || !employeeId.match(/^[0-9a-fA-F]{24}$/)) {
//       return res.status(400).json({ message: "Invalid employee ID" });
//     }

//     // Fetch records
//     const records = await Attendance.find({ employee: employeeId })
//       .populate("employee", "name email department role")
//       .sort({ date: -1 });

//     if (!records || records.length === 0) {
//       return res.status(404).json({ message: "No attendance records found" });
//     }

//     res.status(200).json(records);
//   } catch (err) {
//     console.error("Error fetching employee attendance:", err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// });
app.get("/attendance/all/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Validate ObjectId
    if (!employeeId || !employeeId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid employee ID" });
    }

    // Fetch records
    const records = await Attendance.find({ employee: employeeId })
      .populate("employee", "name email department role")
      .sort({ date: -1 });

    if (!records || records.length === 0) {
      return res.status(404).json({
        message: "No attendance records found",
      });
    }

    // ✅ Add lateCheckIn flag
    const updatedRecords = records.map((record) => {
      let isLate = false;

      if (record.checkIn) {
        const checkIn = new Date(record.checkIn);

        isLate =
          checkIn.getHours() > 9 ||
          (
            checkIn.getHours() === 9 &&
            checkIn.getMinutes() > 10
          );
      }

      return {
        ...record.toObject(),

        lateCheckIn: isLate,
      };
    });

    res.status(200).json(updatedRecords);

  } catch (err) {
    console.error(
      "Error fetching employee attendance:",
      err
    );

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
});

// edit myprofile delete proffile image
app.delete("/employees/:id/image", async (req, res) => {
  try {
    const { id } = req.params;
    const field = req.query.field || "image";

    const employee = await User.findById(id);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    // get the current URL depending on field (passbook stored in bankDetails)
    let fileUrl;
    if (field === "passbookPdf") {
      fileUrl = employee.bankDetails?.passbookPdf;
    } else {
      fileUrl = employee[field];
    }

    if (!fileUrl)
      return res.status(404).json({ error: "No file found for that field" });

    // Helper to extract Cloudinary public_id from URL:
    const getCloudinaryPublicId = (url) => {
      try {
        // Matches: .../upload/(v1234/)?<public_id>.<ext>
        const m = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
        return m ? decodeURIComponent(m[1]) : null;
      } catch (e) {
        return null;
      }
    };

    // If Cloudinary configured, attempt to delete remote file
    let cloudinaryDeleted = false;
    if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      const publicId = getCloudinaryPublicId(fileUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId, { invalidate: true });
          cloudinaryDeleted = true;
        } catch (err) {
          console.warn(
            "Cloudinary deletion failed for",
            publicId,
            err.message || err,
          );
          // We do not abort — still remove DB reference below
        }
      }
    }

    // Remove URL from employee object
    if (field === "passbookPdf") {
      if (employee.bankDetails) {
        employee.bankDetails.passbookPdf = undefined;
      }
    } else {
      employee[field] = undefined;
    }

    await employee.save();

    return res.json({
      message: "File removed from employee record",
      field,
      cloudinaryDeleted,
    });
  } catch (err) {
    console.error("Error deleting employee image:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// leave withdraw : Adesh code
app.delete("/deleteleave/leave/:id", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    session.startTransaction();
    console.log("id", id);
    const leave = await Leave.findById(id).session(session);
    if (!leave) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Leave not found" });
    }

    if ((leave.status || "").toLowerCase() !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ error: "Only pending leaves can be deleted" });
    }

    // delete the leave
    const deleteRes = await Leave.deleteOne({ _id: leave._id }).session(
      session,
    );
    console.log("delete", deleteRes);

    // build robust filter for leaveRef (cover both stored ObjectId and string cases)
    const notifFilter = (() => {
      if (Types.ObjectId.isValid(id)) {
        return { leaveRef: { $in: [new Types.ObjectId(id), id] } };
      }
      return { leaveRef: id };
    })();
    console.log("notifFilter", notifFilter);

    const notifRes =
      await Notification.deleteMany(notifFilter).session(session);
    console.log("delete notification:", notifRes);
    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Leave (pending) deleted successfully",
      leaveDeleted: deleteRes.deletedCount || 0,
      notificationsDeleted: notifRes.deletedCount || 0,
    });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (e) {}
    session.endSession();
    console.error("Error deleting leave + notifications:", err);
    return res.status(500).json({ error: err.message });
  }
});

//adesh code- employeesetting
app.post("/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const id = req.user._id; // from JWT token

    console.log(id);
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Incorrect current password",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    user.refreshToken = null;
    user.verifytoken = null;

    await user.save();

    return res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    console.error("Error changing password:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
app.get("/attendance/manager/:managerId/today", async (req, res) => {
  try {
    const { managerId } = req.params;

    if (!managerId || !managerId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid manager ID" });
    }

   const employees = await User.find(
  { reportingManager: managerId },
  "_id name email department designation role employeeId reportingManager",
);

    if (!employees.length) {
      return res.status(200).json({ employees: [] });
    }

    const employeeIds = employees.map((e) => e._id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const records = await Attendance.find({
      employee: { $in: employeeIds },
      date: today,
    });

    const attendanceMap = new Map();
    records.forEach((rec) => {
      attendanceMap.set(rec.employee.toString(), rec);
    });

    const employeesWithTodayAttendance = employees.map((emp) => {
      const rec = attendanceMap.get(emp._id.toString());
      return {
        _id: emp._id,
        name: emp.name,
        email: emp.email,
        department: emp.department,
        designation: emp.designation,
        role: emp.role,
        employeeId: emp.employeeId,
        reportingManager: emp.reportingManager,

        checkInTime: rec ? rec.checkIn : null,
        checkOutTime: rec ? rec.checkOut : null,
        date: rec ? rec.date : null,
      };
    });

    res.status(200).json({ employees: employeesWithTodayAttendance });
  } catch (err) {
    console.error("Error fetching manager today's attendance:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//Rutuja API Get today attendance for TL team members 
app.get("/attendance/team-leader/:teamLeadId/today", async (req, res) => {
  try {
    const { teamLeadId } = req.params;

    if (!teamLeadId || !teamLeadId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid team leader ID" });
    }

    const teams = await Team.find({ teamLead: teamLeadId })
      .populate({
        path: "assignToProject",
        select: "_id name email employeeId designation department role"
      });

    if (!teams || teams.length === 0) {
      return res.status(200).json({ employees: [] });
    }

    // gst all unique team members
    const memberMap = new Map();
    const memberIds = [];

    teams.forEach(team => {
      if (team.assignToProject && Array.isArray(team.assignToProject)) {
        team.assignToProject.forEach(member => {
          if (member && member._id) {
            const memberId = member._id.toString();
            if (memberId !== teamLeadId && !memberMap.has(memberId)) {
              memberMap.set(memberId, {
                _id: member._id,
                name: member.name,
                email: member.email,
                employeeId: member.employeeId,
                designation: member.designation,
                department: member.department,
                role: member.role
              });
              memberIds.push(memberId);
            }
          }
        });
      }
    });

    if (!memberIds.length) {
      return res.status(200).json({ employees: [] });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const records = await Attendance.find({
      employee: { $in: memberIds },
      date: today,
    });

    const attendanceMap = new Map();
    records.forEach((rec) => {
      attendanceMap.set(rec.employee.toString(), rec);
    });

    const teamMembersWithAttendance = Array.from(memberMap.values()).map((member) => {
      const rec = attendanceMap.get(member._id.toString());
      return {
        _id: member._id,
        name: member.name,
        email: member.email,
        department: member.department,
        role: member.role,
        employeeId: member.employeeId,
        designation: member.designation,
        
        checkInTime: rec ? rec.checkIn : null,
        checkOutTime: rec ? rec.checkOut : null,
        mode: rec ? rec.mode : null,
        workingHours: rec ? rec.workingHours : null,
        dayStatus: rec ? rec.dayStatus : "Absent",
        date: rec ? rec.date : today,
      };
    });

    res.status(200).json({ employees: teamMembersWithAttendance });
  } catch (err) {
    console.error("Error fetching team leader's team attendance:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//updated by rutuja

app.post(
  "/task/create",
  authenticate,
  upload.fields([{ name: "documents", maxCount: 1 }]),
  async (req, res) => {
    try {
      if (req.user.role !== "Team_Leader") { //rutuja
        return res.status(403).json({
          message: "Access denied. Only managers can create tasks.",
        });
      }

      const {
        taskName,
        projectName,
        assignedTo,
        department,
        taskDescription,
        typeOfTask,
        dateOfTaskAssignment,
        dateOfExpectedCompletion,
        estimatedHours,
        progressPercentage,
        comments,
        status,
      } = req.body;

      if (!taskName)
        return res.status(400).json({ message: "Task name is required" });
      if (!projectName)
        return res.status(400).json({ message: "Project name is required" });
      if (!taskDescription)
        return res
          .status(400)
          .json({ message: "Task description is required" });
      if (!typeOfTask)
        return res.status(400).json({ message: "Type of task is required" });
      if (!status)
        return res.status(400).json({ message: "Status is required" });
      if (
        estimatedHours !== undefined &&
        (isNaN(estimatedHours) || Number(estimatedHours) < 0)
      ) {
        return res
          .status(400)
          .json({ message: "Estimated hours must be >= 0" });
      }

      const workingDays = getValidWorkingDays(
        dateOfTaskAssignment,
        dateOfExpectedCompletion,
      );
      const safeWorkingDays = workingDays > 0 ? workingDays : 1;

      const dailyEstimatedHours =
        estimatedHours !== undefined
          ? Number(estimatedHours) / safeWorkingDays
          : 0;

      const taskData = {
        taskName,
        projectName,
        department,
        taskDescription,
        typeOfTask,
        dateOfTaskAssignment,
        dateOfExpectedCompletion,
        progressPercentage,
        comments,
        estimatedHours: Number(estimatedHours),
        status,
        documents: req.files?.documents?.[0]?.path || null,   //rutuja 03-04-26
        createdBy: req.user._id,
      };
      // -----------------------------------------------

      if (
        progressPercentage !== undefined &&
        progressPercentage !== null &&
        progressPercentage !== ""
      ) {
        taskData.progressPercentage = progressPercentage;
      } else {
        taskData.progressPercentage = 0;
      }

      if (comments && comments.trim() !== "") {
        taskData.comments = [
          {
            text: comments,
            createdAt: new Date(),
          },
        ];
      } else {
        taskData.comments = [];
      }
      // --------------------------------------------------

      // -------------------------------------
      if (
        assignedTo &&
        assignedTo.trim() !== "" &&
        mongoose.Types.ObjectId.isValid(assignedTo)
      ) {
        taskData.assignedTo = assignedTo;
      } else {
        taskData.assignedTo = null;
      }
      // -------------------------------

      const newTask = await Task.create({
        ...taskData,
        workingDays,
        dailyEstimatedHours,
      });
      const populatedTask = await Task.findById(newTask._id)
        .populate("assignedTo", "name email department")
        .populate("status", "name")
        .populate("comments.user", "name")
        .populate("createdBy", "name email username");

      let notificationMessage = "";
      let adminNotificationMessage = "";
      // rutuja code start
      let reportingManagerNotificationMessage = "";


      if (
        taskData.assignedTo &&
        mongoose.Types.ObjectId.isValid(taskData.assignedTo)
      ) {
        try {
          const employeeExists = await User.findById(taskData.assignedTo);

          if (employeeExists) {
            await TaskNotification.create({
              user: taskData.assignedTo,
              type: "Task_Assigned",
              message: `New task "${taskName}" assigned to you in project "${projectName}"`,
              taskRef: newTask._id,
              isRead: false,
            });
            notificationMessage = " and notification sent to assigned employee";
          } else {
            console.log("User not found for ID:", taskData.assignedTo);
          }
        } catch (error) {
          console.log("Error creating notification:", error.message);
          console.log("Error details:", error);
          notificationMessage = " (notification failed)";
        }
      }
      //rutuja code start
      try {
        if (taskData.assignedTo && mongoose.Types.ObjectId.isValid(taskData.assignedTo)) {
          const assignedEmployee = await User.findById(taskData.assignedTo).populate("reportingManager");
          
          if (assignedEmployee && assignedEmployee.reportingManager) {
            await TaskNotification.create({
              user: assignedEmployee.reportingManager._id,
              type: "Task_Created",
              message: `New task "${taskName}" has been assigned to ${assignedEmployee.name}."`,
              taskRef: newTask._id,
              isRead: false,
            });
            reportingManagerNotificationMessage = " and notification sent to reporting manager";
          }
        }
      } catch (error) {
        console.log("Error sending reporting manager notification:", error.message);
      }

      //rutuja code end

      try {
        // Find users with admin, hr, or ceo coo roles
        const adminUsers = await User.find({
          role: { $in: ["admin", "hr", "ceo", "coo"] },
        }).select("_id");

        if (adminUsers.length > 0) {
          const adminMessage = `New task "${taskName}" has been created for project "${projectName}".`;

          for (const admin of adminUsers) {
            await TaskNotification.create({
              user: admin._id,
              type: "Task_Created",
              message: adminMessage,
              taskRef: newTask._id,
              isRead: false,
            });
          }
        }
      } catch (error) {
        console.log("Error sending admin notification:", error.message);
      }

      return res.status(201).json({
        message: `Task created successfully${notificationMessage}`,
        task: populatedTask,
        notificationSent: notificationMessage.includes("sent") ? true : false,
      });
    } catch (error) {
      console.error("CREATE TASK ERROR:", error);
      return res.status(400).json({ message: error.message });
    }
  },
);


app.put(
  "/task/:id",
  authenticate,
  upload.fields([{ name: "documents", maxCount: 1 }]),
  async (req, res) => {
    try {
      const taskId = req.params.id;

      const existingTask = await Task.findById(taskId);
      if (!existingTask) {
        return res.status(404).json({ message: "Task not found" });
      }

      if (
        req.user.role !== "Team_Leader" || //rutuja
        existingTask.createdBy.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({
          message: "Access denied. You can only edit tasks you created.",
        });
      }

      const {
        taskName,
        department,
        typeOfTask,
        taskDescription,
        dateOfTaskAssignment,
        dateOfExpectedCompletion,
        estimatedHours,
        progressPercentage,
        assignedTo,
        status,
      } = req.body;

      if (assignedTo && assignedTo !== "") {
        const employeeExists = await User.findById(assignedTo);
        if (!employeeExists) {
          return res.status(400).json({
            message: "Assigned employee not found",
          });
        }
      }

      let statusId = status;
      if (status && status !== "") {
        if (!mongoose.Types.ObjectId.isValid(status)) {
          const statusName = await Status.findOne({ name: status });
          if (!statusName) {
            return res
              .status(400)
              .json({ message: `Status "${status}" not found` });
          }
          statusId = statusName._id;
        }
      }
      //Added  by jaicy
      const workingDays = getValidWorkingDays(
        dateOfTaskAssignment || existingTask.dateOfTaskAssignment,
        dateOfExpectedCompletion || existingTask.dateOfExpectedCompletion,
      );
      const safeWorkingDays = workingDays > 0 ? workingDays : 1;

      const finalEstimatedHours =
        estimatedHours !== undefined
          ? Number(estimatedHours)
          : existingTask.estimatedHours || 0;

      const dailyEstimatedHours = finalEstimatedHours / safeWorkingDays;

      const updateData = {
        taskName,
        department,
        typeOfTask,
        taskDescription,
        estimatedHours: finalEstimatedHours,
        workingDays,
        dailyEstimatedHours,
        dateOfTaskAssignment:
          dateOfTaskAssignment || existingTask.dateOfTaskAssignment,
        dateOfExpectedCompletion:
          dateOfExpectedCompletion || existingTask.dateOfExpectedCompletion,
      };

      if (assignedTo !== undefined && assignedTo !== "") {
        updateData.assignedTo = assignedTo;
      }
      if (status !== undefined) {
        updateData.status = statusId === "" ? null : statusId;
      }

      if (progressPercentage !== undefined && progressPercentage !== "") {
        updateData.progressPercentage = progressPercentage;
      } else if (existingTask.progressPercentage) {
        updateData.progressPercentage = existingTask.progressPercentage;
      } else {
        updateData.progressPercentage = 0;
      }

      if (req.files?.documents?.[0]) {
        updateData.documents = req.files.documents[0].path; //rutuja 03-04-26
      }


      const updatedTask = await Task.findByIdAndUpdate(taskId, updateData, {
        new: true,
        runValidators: true,
      })
        .populate("assignedTo", "name email department")
        .populate("status", "name")
        .populate("comments.user", "name")
        .populate("createdBy", "name email username");

      if (
        assignedTo &&
        assignedTo !== "" &&
        existingTask.assignedTo?.toString() !== assignedTo
      ) {
        try {
          const employeeExists = await User.findById(assignedTo);

          if (employeeExists) {
            await TaskNotification.create({
              user: assignedTo,
              type: "Task_assigned",
              message: `You have been assigned to task "${
                taskName || updatedTask.taskName
              }".`,
              taskRef: updatedTask._id,
              isRead: false,
            });

            await TaskNotification.create({
              user: assignedTo,
              type: "Task_updated",
              message: `Task "${
                taskName || updatedTask.taskName
              }" has been updated.`,
              taskRef: updatedTask._id,
              isRead: false,
            });
          }
        } catch (error) {
          console.log("Error creating assignment notification:", error.message);
        }
      } else if (
        updatedTask.assignedTo &&
        mongoose.Types.ObjectId.isValid(updatedTask.assignedTo._id)
      ) {
        try {
          const employeeExists = await User.findById(
            updatedTask.assignedTo._id,
          );

          if (employeeExists) {
            await TaskNotification.create({
              user: updatedTask.assignedTo._id,
              type: "Task_updated",
              message: `Task "${
                taskName || updatedTask.taskName
              }" has been updated.`,
              taskRef: updatedTask._id,
              isRead: false,
            });
          }
        } catch (error) {
          console.log("Error creating update notification:", error.message);
        }
      }

      // Send notifications to admins
      try {
        const adminUsers = await User.find({
          role: { $in: ["admin", "hr", "ceo", "coo"] },
        }).select("_id");

        if (adminUsers.length > 0) {
          const adminMessage = `Task "${
            taskName || updatedTask.taskName
          }" has been updated.`;

          const notificationPromises = adminUsers.map((admin) =>
            TaskNotification.create({
              user: admin._id,
              type: "Task_updated",
              message: adminMessage,
              taskRef: updatedTask._id,
              isRead: false,
            }),
          );

          await Promise.all(notificationPromises);
        }
      } catch (error) {
        console.log("Error sending admin notification:", error.message);
      }

      return res.status(200).json({
        message: "Task updated successfully",
        task: updatedTask,
      });
    } catch (error) {
      console.error("UPDATE TASK ERROR:", error);
      return res.status(400).json({ message: error.message });
    }
  },
);

app.get("/task/getall", async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate({
        path: "assignedTo",
        select: "name username email employeeId",
        model: "User",
      })
      .populate({
        path: "status",
        select: "name _id",
        model: "Status",
      })
      .populate({
        path: "createdBy",
        select: "name username role ",
        model: "User",
      });
    return res.status(200).json(tasks);
  } catch (error) {
    // console.error("error to get tasks:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// Get tasks created by a specific manager
app.get("/tasks/:managerId", async (req, res) => {
  try {
    const tasks = await Task.find({ createdBy: req.params.managerId })
      .populate({
        path: "assignedTo",
        select: "name username email employeeId",
        model: "User",
      })
      .populate({
        path: "status",
        select: "name _id",
        model: "Status",
      })
      .populate({
        path: "createdBy",
        select: "name email employeeId",
        model: "User",
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks: tasks,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

app.delete("/task/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    if (task.documents?.public_id) {
      await cloudinary.uploader.destroy(task.documents.public_id, {
        resource_type: "raw",
      });
    }

    await TaskNotification.deleteOne({ taskRef: req.params.id });

    await Task.findByIdAndDelete(req.params.id);

    res
      .status(200)
      .json({ message: "Task deleted successfully also Delete notification" });
  } catch (err) {
    // console.error("Error to Delete Task:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// Add Comment to Task
app.post("/task/:taskId/comment", authenticate, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { comment } = req.body;
    const userId = req.user._id;

    // Validate comment
    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID",
      });
    }

    const task = await Task.findById(taskId)
      .populate("createdBy", "_id name")
      .populate("assignedTo", "_id ,name");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const isCreator = task.createdBy && task.createdBy._id.toString() === userId.toString();

    const isAssignee = task.assignedTo && task.assignedTo._id.toString() === userId.toString();

    if (!isCreator && !isAssignee) {
      return res.status(403).json({
        success: false,
        message: "Only task creator or assignee can add comments",
      });
    }
    const commenter = await User.findById(userId).select("name");

    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      {
        $push: {
          comments: {
            text: comment.trim(),
            user: userId,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    );

    const populatedTask = await Task.findById(taskId)
      .populate({
        path: "comments.user",
        select: "name email role profilePicture",
      })
      .select("comments");

    const latestComment =
      populatedTask.comments[populatedTask.comments.length - 1];

      const notificationMessage = `${commenter.name} commented on task "${task.taskName}"`;

      const usersToNotify = new Set();
    
      if (task.createdBy && task.createdBy._id.toString() !== userId.toString()) {
        usersToNotify.add(task.createdBy._id.toString());
      }
      
      if (task.assignedTo && task.assignedTo._id.toString() !== userId.toString()) {
        usersToNotify.add(task.assignedTo._id.toString());
      }
      
      // Create notifications
      const notifications = [];
      for (const notifyUserId of usersToNotify) {
        notifications.push({
          user: notifyUserId,
          type: "Task_Comment",
          message: notificationMessage,
          taskRef: task._id,
          isRead: false,
          triggeredBy: userId,
          triggeredByRole: req.user.role.toUpperCase(),
          createdAt: new Date()
        });
      }
      
      if (notifications.length > 0) {
        await TaskNotification.insertMany(notifications);
      }
      
    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment: latestComment,
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get all comments for a task
app.get("/task/:taskId/comments", async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID",
      });
    }

    const task = await Task.findById(taskId)
      .populate({
        path: "comments.user",
        select: "name email role profilePicture",
      })
      .select("comments taskName");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const sortedComments = task.comments
      ? task.comments.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        )
      : [];

    res.status(200).json({
      success: true,
      taskName: task.taskName,
      count: sortedComments.length,
      comments: sortedComments,
    });
  } catch (error) {
    console.error("Error getting task comments:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

app.delete(
  "/task/:taskId/comment/:commentId",
  authenticate,
  async (req, res) => {
    try {
      const { taskId, commentId } = req.params;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(taskId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid task ID",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(commentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid comment ID",
        });
      }

      const task = await Task.findById(taskId);

      if (!task) {
        return res.status(404).json({
          success: false,
          message: "Task not found",
        });
      }

      if (!Array.isArray(task.comments) || task.comments.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No comments found",
        });
      }

      const commentIndex = task.comments.findIndex(
        (comment) => comment._id.toString() === commentId,
      );

      if (commentIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Comment not found",
        });
      }

      const comment = task.comments[commentIndex];

      const isCommentCreator =
        comment.user && comment.user.toString() === userId.toString();

      const populatedTask = await Task.findById(taskId)
        .populate("createdBy", "_id")
        .populate("assignedTo", "_id");

      const isTaskCreator =
        populatedTask.createdBy &&
        populatedTask.createdBy._id.toString() === userId.toString();
      const isTaskAssignee =
        populatedTask.assignedTo &&
        populatedTask.assignedTo._id.toString() === userId.toString();

      if (!isCommentCreator && !isTaskCreator && !isTaskAssignee) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to delete this comment",
        });
      }

      task.comments.splice(commentIndex, 1);

      await task.save();

      res.status(200).json({
        success: true,
        message: "Comment deleted successfully",
        deletedCommentId: commentId,
      });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

app.put("/task/:taskId/comment/:commentId", authenticate, async (req, res) => {
  try {
    const { taskId, commentId } = req.params;
    const { comment: commentText } = req.body;
    const userId = req.user._id;

    if (!commentText || !commentText.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot be empty",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(taskId) ||
      !mongoose.Types.ObjectId.isValid(commentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID or comment ID",
      });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (!Array.isArray(task.comments) || task.comments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    const commentIndex = task.comments.findIndex(
      (c) =>
        c._id.toString() === commentId &&
        c.user.toString() === userId.toString(),
    );

    if (commentIndex === -1) {
      const commentExists = task.comments.some(
        (c) => c._id.toString() === commentId,
      );

      if (commentExists) {
        return res.status(403).json({
          success: false,
          message: "You can only edit your own comments",
        });
      } else {
        return res.status(404).json({
          success: false,
          message: "Comment not found",
        });
      }
    }

    task.comments[commentIndex].text = commentText.trim();
    task.comments[commentIndex].updatedAt = new Date();
    task.comments[commentIndex].isEdited = true;

    await task.save();

    const populatedTask = await Task.findById(taskId)
      .populate({
        path: "comments.user",
        select: "name email role ",
      })
      .select("comments");

    const updatedComment = populatedTask.comments.id(commentId);

    res.status(200).json({
      success: true,
      message: "Comment updated successfully",
      comment: {
        _id: updatedComment._id,
        text: updatedComment.text,
        user: updatedComment.user,
        createdAt: updatedComment.createdAt,
        updatedAt: updatedComment.updatedAt,
        isEdited: updatedComment.isEdited,
      },
    });
  } catch (error) {
    console.error("Error editing comment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});


// rutuja api to get all team lead
app.get("/teamLead", async (req, res) => {
  try {
    const managers = await User.find({ role: "Team_Leader" }).select(
      "_id name email designation profile department",
    );
    res.status(200).json(managers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch managers" });
  }
});

// rutuja api to get TL Projects
app.get("/:teamLeadId/projects", async (req, res) => {
  try {
    const { teamLeadId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(teamLeadId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Team Leader ID"
      });
    }

    const teamLead = await User.findById(teamLeadId);
    if (!teamLead) {
      return res.status(404).json({
        success: false,
        message: "Team Leader not found"
      });
    }

    const teams = await Team.find({ teamLead: { $in: [teamLeadId] } })
      .populate("project", "name projectCode clientName startDate endDate dueDate priority progressPercentage")
      .select("name project department assignToProject");

    if (!teams || teams.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        projects: []
      });
    }

    const projects = teams.map(team => ({
      teamId: team._id,
      teamName: team.name,
      department: team.department,
      project: team.project ? {
        _id: team.project._id,
        name: team.project.name,
        projectCode: team.project.projectCode,
        clientName: team.project.clientName,
        startDate: team.project.startDate,
        endDate: team.project.endDate,
        dueDate: team.project.dueDate,
        priority: team.project.priority,
        progress: team.project.progressPercentage || 0
      } : null,
      teamMembersCount: team.assignToProject?.length || 0
    })).filter(item => item.project !== null); 

    res.status(200).json({
      success: true,
      count: projects.length,
      projects: projects
    });

  } catch (error) {
    console.error("Error fetching Team Leader projects:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
      error: error.message
    });
  }
});


//rutuja api to get Team lead task
app.get("/tasks/:teamLeadId", async (req, res) => {
  try {
    const tasks = await Task.find({ createdBy: req.params.teamLeadId })
      .populate({
        path: "assignedTo",
        select: "name username email employeeId",
        model: "User",
      })
      .populate({
        path: "status",
        select: "name _id",
        model: "Status",
      })
      .populate({
        path: "createdBy",
        select: "name email employeeId role",
        model: "User",
      })
      .sort({ createdAt: -1 });

      const tasksWithDelay = tasks.map(task => {
        const taskObj = task.toObject();
        const delayDays = calculateDelayDays(task);
        
        return {
          ...taskObj,
          delayedBy: delayDays === null ? null : delayDays,
          isDelayed: delayDays > 0
        };
      });

    return res.status(200).json({
      success: true,
      count: tasksWithDelay.length,
      tasks: tasksWithDelay,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// rutuja api to get manager assign emp tasks
app.get("/manager/emp/task/:managerId/", async (req, res) => {
  try {
    const { managerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(managerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid manager ID"
      });
    }

    const employees = await User.find(
      { 
        reportingManager: managerId,
        isDeleted: false,
        role: { $in: ["employee", "Team_Leader"] }
      },
      { _id: 1, name: 1, employeeId: 1, designation: 1 }
    );

    if (!employees.length) {
      return res.status(200).json({
        success: true,
        message: "No employees found under this manager",
        totalEmployees: 0,
        totalTasks: 0,
        tasks: []
      });
    }

    const employeeIds = employees.map(emp => emp._id);

    const tasks = await Task.find({ assignedTo: { $in: employeeIds } })
      .populate({
        path: "assignedTo",
        select: "name email employeeId designation department",
        model: "User"
      })
      .populate({
        path: "status",
        select: "name _id",
        model: "Status"
      })
      .populate({
        path: "createdBy",
        select: "name email role",
        model: "User"
      })
      .populate({
        path: "comments.user",
        select: "name email",
        model: "User"
      })
      .sort({ createdAt: -1 });

    const tasksByEmployee = {};
    employees.forEach(emp => {
      tasksByEmployee[emp._id] = {
        employee: emp,
        tasks: []
      };
    });

    tasks.forEach(task => {
      const empId = task.assignedTo?._id?.toString();
      if (empId && tasksByEmployee[empId]) {
        tasksByEmployee[empId].tasks.push(task);
      }
    });

    res.status(200).json({
      success: true,
      totalEmployees: employees.length,
      totalTasks: tasks.length,
      tasksByEmployee: Object.values(tasksByEmployee),
      allTasks: tasks 
    });
  } catch (error) {
    console.error("FETCH ALL MANAGER EMPLOYEE TASKS ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tasks for manager's employees",
      error: error.message
    });
  }
});

app.get("/:teamLeadId/members", async (req, res) => {
  try {
    const { teamLeadId } = req.params;

    const teams = await Team.find({ teamLead: teamLeadId })
      .populate({
        path: "assignToProject",
        select: "name email employeeId designation department contact doj"
      });

    if (!teams || teams.length === 0) {
      return res.json({
        success: true,
        members: []
      });
    }

    const members = [];
    const memberIds = new Set();

    for (const team of teams) {
      for (const member of team.assignToProject) {

        if (
          member._id.toString() !== teamLeadId &&
          !memberIds.has(member._id.toString())
        ) {
          memberIds.add(member._id.toString());

          // Get ALL resignations (IMPORTANT)
          const resignations = await Resignation.find({
            employee: member._id,
          }).populate("approvedBy", "name role");

          members.push({
            _id: member._id,
            name: member.name,
            email: member.email,
            employeeId: member.employeeId,
            designation: member.designation,
             department: member.department,
            contact: member.contact || null,
            doj: member.doj || null,

            // ✅ Send array
            resignations: resignations.map(r => ({
              resignationId: r.resignationId,
              status: r.status,
              applyDate: r.applyDate,
              reason: r.reason,
               department: r.department,
              comments: r.comments || "",
              lastWorkingDay: r.lastWorkingDay || null,
              approvedBy: r.approvedBy || null,
              approvedDate: r.approvedDate || null,
              approverComment: r.approverComment || ""
            }))
          });
        }
      }
    }

    res.json({
      success: true,
      totalMembers: members.length,
      members: members
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
//rutuja api to get Employee team member
app.get("/employee/:employeeId/team-member", async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID"
      });
    }

    const teams = await Team.find({
      assignToProject: { $in: [employeeId] }
    }).populate({
      path: "assignToProject",
      select: "name email employeeId designation department role image contact"
    }).populate({
      path: "teamLead",
      select: "name email employeeId designation department role image contact"
    });

    if (!teams || teams.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Employee is not assigned to any team",
        teamMembers: []
      });
    }

    const memberMap = new Map(); 

    teams.forEach(team => {
      if (team.assignToProject && Array.isArray(team.assignToProject)) {
        team.assignToProject.forEach(member => {
          if (member && member._id) {
            const memberId = member._id.toString();
            if (memberId !== employeeId) {
              memberMap.set(memberId, {
                _id: member._id,
                name: member.name || null,
                email: member.email || null,
                employeeId: member.employeeId || null,
                designation: member.designation || null,
                department: member.department || null,
                role: member.role || null,
                contact: member.contact || null,
                image: member.image || null
              });
            }
          }
        });
      }

      if (team.teamLead && team.teamLead._id) {
        const leadId = team.teamLead._id.toString();
        if (leadId !== employeeId) {
          memberMap.set(leadId, {
            _id: team.teamLead._id,
            name: team.teamLead.name || null,
            email: team.teamLead.email || null,
            employeeId: team.teamLead.employeeId || null,
            designation: team.teamLead.designation || null,
            department: team.teamLead.department || null,
            role: team.teamLead.role || null,
            contact: team.teamLead.contact || null,
            image: team.teamLead.image || null
          });
        }
      }
    });

    const teamMembers = Array.from(memberMap.values());

    res.status(200).json({
      success: true,
      employeeId: employeeId,
      totalTeamMembers: teamMembers.length,
      teamMembers: teamMembers
    });

  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});

// rutuja api to get available employee under TL
app.get("/:teamLeadId/available-employees", authenticate, async (req, res) => {
  try {
    const { teamLeadId } = req.params;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); 

    const teams = await Team.find({ teamLead: teamLeadId })
      .populate({
        path: "assignToProject",
        select: "name email employeeId designation image contact doj" 
      });

    if (!teams || teams.length === 0) {
      return res.json({
        success: true,
        availableEmployees: [],
        message: "No teams found for this team lead"
      });
    }

    const allMembers = [];
    const memberIds = [];

    teams.forEach(team => {
      team.assignToProject.forEach(member => {
        if (member._id.toString() !== teamLeadId) {
          if (!memberIds.includes(member._id.toString())) {
            memberIds.push(member._id.toString());
            allMembers.push({
              _id: member._id,
              name: member.name,
              email: member.email,
              employeeId: member.employeeId,
              designation: member.designation,
              profileImage: member.image,
              contact: member.contact,          
              doj: member.doj                      
            });
          }
        }
      });
    });

    if (allMembers.length === 0) {
      return res.json({
        success: true,
        availableEmployees: [],
        message: "No team members found"
      });
    }

    const employeesWithTasksToday = await Task.find({
      assignedTo: { $in: memberIds },
      dateOfTaskAssignment: { 
        $gte: today, 
        $lt: tomorrow 
      }
    }).distinct('assignedTo');

    const employeesWithTasksTodaySet = new Set(
      employeesWithTasksToday.map(id => id.toString())
    );

    const availableEmployees = allMembers.filter(
      member => !employeesWithTasksTodaySet.has(member._id.toString())
    );

    const busyEmployees = allMembers.filter(
      member => employeesWithTasksTodaySet.has(member._id.toString())
    );

    res.json({
      success: true,
      availableEmployees: availableEmployees,
      summary: {
        totalTeamMembers: allMembers.length,
        availableToday: availableEmployees.length,
        busyToday: busyEmployees.length,
        date: today.toISOString().split('T')[0] 
      }
    });

  } catch (error) {
    console.error("Error in available-employees:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});







// Admin Add Task  Status
app.post("/taskstatus/add", async (req, res) => {
  try {
    const { name, description } = req.body;

    const cleanName = name?.trim();
    const cleanDescription = description?.trim() || "";

    if (!cleanName) {
      return res.status(400).json({
        message: "Please provide a valid status name",
      });
    }

    const existing = await Status.findOne({
      name: { $regex: new RegExp(`^${cleanName}$`, "i") },
    });

    if (existing) {
      return res.status(400).json({
        message: "This status already exists",
      });
    }

    const newStatus = new Status({
      name: cleanName,
      description: cleanDescription,
    });

    await newStatus.save();

    res.status(201).json({
      message: "Status added successfully",
      status: newStatus,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
});
// Admin Update Task Status
app.put("/taskstatus/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const cleanName = name?.trim();
    const cleanDescription = description?.trim() || "";

    if (!cleanName) {
      return res.status(400).json({
        message: "Please provide a valid status name",
      });
    }

    const status = await Status.findById(id);
    if (!status) {
      return res.status(404).json({
        message: "Status not found",
      });
    }

    // 🔑 IMPORTANT: Only check duplicate if name is changed
    if (status.name.toLowerCase() !== cleanName.toLowerCase()) {
      const existing = await Status.findOne({
        name: { $regex: new RegExp(`^${cleanName}$`, "i") },
      });

      if (existing) {
        return res.status(400).json({
          message: "This status already exists",
        });
      }
    }

    status.name = cleanName;
    status.description = cleanDescription;

    await status.save();

    res.status(200).json({
      message: "Status updated successfully",
      status,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

// Admin Delete Task Status
app.delete("/taskstatus/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const status = await Status.findById(id);
    if (!status) {
      return res.status(404).json({
        message: "Status not found",
      });
    }

    await Status.findByIdAndDelete(id);

    res.status(200).json({
      message: "Status deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

// Admin Set Task Status to Task
app.put("/task/:taskId/set-status", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update task status",
      });
    }

    const { taskId } = req.params;
    const { statusId } = req.body;

    // console.log("task Id:", taskId);
    // console.log("status Id:", statusId);

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const status = await Status.findById(statusId);
    if (!status) {
      return res.status(404).json({
        message: "Status not found",
      });
    }

    const oldStatus = await Status.findById(task.status);
    const oldStatusName = oldStatus ? oldStatus.name : "Previous";

    task.status = statusId;
    await task.save();

    const updatedTask = await Task.findById(taskId)
      .populate("assignedTo", "name email")
      .populate("status", "name description");

    // Notification
    if (updatedTask.assignedTo) {
      await TaskNotification.create({
        user: updatedTask.assignedTo._id,
        type: "Task_Status_Change",
        message: `Admin added status "${status.name}" to task "${updatedTask.taskName}"`,
        taskRef: taskId,
        isRead: false,
      });
    }

    res.status(200).json({
      success: true,
      message: "Task status updated successfully",
      data: updatedTask,
    });
  } catch (err) {
    // console.error("Set task status error:", err);
    res.status(500).json({
      message: "Server error",
    });
  }
});

app.get("/taskstatus/all", async (req, res) => {
  try {
    const statuses = await Status.find().sort({ createdAt: -1 });

    res.status(200).json({
      message: "Statuses fetched successfully",
      count: statuses.length,
      statuses,
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

app.get("/unique", async (req, res) => {
  try {
    const statuses = await Status.aggregate([
      {
        $group: {
          _id: { $toLower: "$name" }, // grouping key (case-insensitive)
          statusId: { $first: "$_id" }, // keep one real document _id
          name: { $first: "$name" },
        },
      },
      {
        $project: {
          _id: 0,
          id: "$statusId",
          name: 1,
        },
      },
      {
        $sort: { name: 1 },
      },
    ]);

    res.status(200).json({
      success: true,
      count: statuses.length,
      data: statuses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

//create notification
app.post("/task-notifications", async (req, res) => {
  try {
    const { user, type, message, taskRef, projectRef } = req.body;

    if (!user || !type || !message) {
      return res.status(400).json({
        message: "User, type, and message are required",
      });
    }

    const userExists = await User.findById(user);
    if (!userExists) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const newNotification = new TaskNotification({
      user,
      type,
      message,
      taskRef: taskRef || null,
      projectRef: projectRef || null,
      isRead: false,
    });

    await newNotification.save();

    await newNotification.populate("user", "name email employeeId");
    if (taskRef) {
      await newNotification.populate("taskRef", "taskName projectName");
    }
    if (projectRef) {
      await newNotification.populate("projectRef", "name");
    }

    res.status(201).json({
      message: "Notification created successfully",
      notification: newNotification,
    });
  } catch (err) {
    console.error("Error creating notification:", err);
    res.status(500).json({
      message: "Server error",
    });
  }
});

//mark notification as read
app.put("/tasknotifications/:id/read", async (req, res) => {
  try {
    const notification = await TaskNotification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true },
    );
    if (!notification) {
      return res.status(404).json({
        message: "Task Notifications not found",
      });
    }
    res.json(notification);
  } catch (err) {
    res.status(500).json({
      message: "Server error",
    });
  }
});

//Delete Notification
app.delete("/tasknotifications/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await TaskNotification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }
    res.json({
      message: "Notification deleted successfully",
    });
  } catch (error) {
    // console.error("Error deleting notification:", err);
    res.status(500).json({
      message: "Server error",
    });
  }
});

app.get("/task-notifications/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const notifications = await TaskNotification.find({ user: userId })
      .populate("user", "name email employeeId role department")
      .populate(
        "taskRef",
        "taskName projectName status dateOfTaskAssignment dateOfExpectedCompletion",
      )
      .populate("projectRef", "name description")
      .sort({ createdAt: -1 });

    res.status(200).json(notifications);
  } catch (err) {
    // console.error("Error get task notifications:", err);
    res.status(500).json({
      message: "Server error",
    });
  }
});

app.get("/managers/list", async (req, res) => {
  try {
    const managers = await User.find(
      { role: "manager", isDeleted: { $ne: true } },
      "_id name email employeeId",
    ).sort({ name: 1 });

    res.status(200).json(managers);
  } catch (error) {
    console.error("Error fetching managers:", error);
    res.status(500).json({
      message: "Failed to fetch managers",
    });
  }
});


const calculateDelayDays = (task) => {
  if (!task?.dateOfExpectedCompletion) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(task.dateOfExpectedCompletion);
  dueDate.setHours(0, 0, 0, 0);
  
  const statusName = task.status?.name || task.status;
    if (statusName === "Completed") {
    if (!task.completedAt) return null;
    
    const completedDate = new Date(task.completedAt);
    completedDate.setHours(0, 0, 0, 0);
    
    if (completedDate > dueDate) {
      return Math.ceil((completedDate - dueDate) / (1000 * 60 * 60 * 24));
    }
    return 0;
  }
  
  if ((statusName === "In Progress" || statusName === "Assigned") && dueDate < today) {
    return Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
  }
  //hold and cancel
  return 0;
};


app.get("/tasks/assigned/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Validate employeeId
    if (!employeeId || !employeeId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid employee ID" });
    }

    // Fetch tasks assigned to employee
    const tasks = await Task.find({ assignedTo: employeeId })
      .populate("assignedTo", "name email employeeId")
      .populate("status", "name")
      .populate("projectName")
      .populate({
        path: "comments.user",
        select: "name email role employeeId designation" 
      })
      .sort({ createdAt: -1 });

      const tasksWithDelay = tasks.map(task => {
        const taskObj = task.toObject();
        const delayDays = calculateDelayDays(task);
        
        return {
          ...taskObj,
          delayedBy: delayDays === null ? null : delayDays,
          isDelayed: delayDays > 0
        };
      });

    return res.status(200).json({
      message: "Assigned tasks fetched successfully",
      count: tasksWithDelay.length,
      tasks: tasksWithDelay,
    });
  } catch (error) {
    console.error("FETCH ASSIGNED TASK ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
});


//update task status employee
app.put("/task/:taskId/status", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(status)) {
      return res.status(400).json({ message: "Invalid status ID" });
    }

    const task = await Task.findById(taskId)
      .populate("assignedTo", "name reportingManager")
      .populate("status")
      .populate("createdBy", "name email role");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const statusDoc = await Status.findById(status);
    const isCompleted = statusDoc && statusDoc.name === "Completed";

    const updateData = { status };
    if (isCompleted) {
      updateData.completedAt = new Date();
    } else {
      updateData.completedAt = null;
    }


    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      { status },
      { new: true },
    )
      .populate("assignedTo", "name reportingManager")
      .populate("createdBy", "name email role")
      .populate("status");

    const newStatus = await Status.findById(status);

    let managerId = null;
    if (task.assignedTo && task.assignedTo.reportingManager) {
      managerId = task.assignedTo.reportingManager;
    }

    if (managerId) {
      await TaskNotification.create({
        user: managerId,
        type: "Task_Status_Update",
        message: `${task.assignedTo.name} updated task "${task.taskName}" status to "${newStatus.name}"`,
        taskRef: task._id,
        isRead: false,
      });
    }

    if (task.createdBy && task.createdBy._id) {
      if (task.createdBy._id.toString() !== task.assignedTo?._id?.toString()) {
        await TaskNotification.create({
          user: task.createdBy._id,
          type: "Task_Status_Update",
          message: `${task.assignedTo?.name || "Employee"} updated task "${task.taskName}" status to "${newStatus.name}"`,
          taskRef: task._id,
          isRead: false,
        });
      }
    }

    res.status(200).json({
      message: "Task status updated successfully",
      task: updatedTask,
      completedAt: updatedTask.completedAt,
    });
  } catch (error) {
    console.error("UPDATE TASK STATUS ERROR:", error);
    res.status(500).json({ message: error.message });
  }
});

app.get("/employees/manager/:managerId/team-status", async (req, res) => {
  try {
    const { managerId } = req.params;

    // 1️⃣ Employees under manager
    const employees = await User.find(
      { reportingManager: managerId },
      { name: 1, email: 1 },
    );

    if (!employees.length) {
      return res.status(200).json({
        success: true,
        inTeam: [],
        notInTeam: [],
      });
    }

    // 2️⃣ Teams with populated members
    const teams = await Team.find({ manager: managerId })
      .populate("members", "name email")
      .select("teamName members");

    // 3️⃣ Collect team member IDs
    const teamMemberSet = new Set();
    teams.forEach((team) => {
      team.members.forEach((m) => {
        teamMemberSet.add(m._id.toString());
      });
    });

    // 4️⃣ Separate employees
    const inTeam = [];
    const notInTeam = [];

    employees.forEach((emp) => {
      if (teamMemberSet.has(emp._id.toString())) {
        inTeam.push(emp);
      } else {
        notInTeam.push(emp);
      }
    });

    res.status(200).json({
      success: true,
      teams, // 👈 team + members
      inTeam, // 👈 employees assigned to any team
      notInTeam, // 👈 employees not in any team
    });
  } catch (error) {
    console.error("Error fetching team status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch team employees",
    });
  }
});
//Show Employee Assigned Project
// app.get("/projects/employee/:employeeId", async (req, res) => {
//   try {
//     const { employeeId } = req.params;
//     // assign by Admin
//     const adminProjects = await Project.find({
//       assignedEmployees: employeeId,
//     })
//       .populate("status", "name")
//       .populate("managers", "name email employeeId designation department")
//       .populate(
//         "assignedEmployees",
//         "name email employeeId designation department"
//       )
//       .sort({ createdAt: -1 });

//     // assign by manager
//     const teamAssignments = await Team.find({
//       assignToProject: employeeId,
//     }).populate({
//       path: "project",
//       populate: [
//         { path: "status", select: "name" },
//         {
//           path: "managers",
//           select: "name email employeeId designation department",
//         },
//         {
//           path: "assignedEmployees",
//           select: "name email employeeId designation department",
//         },
//       ],
//     });

//     const teamProjects = teamAssignments
//       .map((team) => team.project)
//       .filter((project) => project !== null);

//     const allProjects = [...adminProjects, ...teamProjects];
//     const uniqueProjects = [];
//     const seenIds = new Set();

//     allProjects.forEach((project) => {
//       if (project && !seenIds.has(project._id.toString())) {
//         seenIds.add(project._id.toString());
//         uniqueProjects.push(project);
//       }
//     });

//     res.status(200).json({
//       success: true,
//       count: uniqueProjects.length,
//       projects: uniqueProjects,
//     });
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({
//       message: "Server error",
//     });
//   }
// });
// // get employees assigned to a project
// app.get("/projects/employees/:projectId", async (req, res) => {
//   try {
//     const { projectId } = req.params;

//     const team = await Team.findOne({ project: projectId })
//       .populate("assignToProject", "_id name email department")
//       .select("assignToProject");

//     if (!team) {
//       return res.status(404).json({
//         success: false,
//         message: "No team assigned to this project",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       count: team.assignToProject.length,
//       data: team.assignToProject || [],
//     });
//   } catch (error) {
//     console.error("GET PROJECT EMPLOYEES ERROR:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// });
//Komal

// komal's code

app.get("/projects/employee/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    // 1️⃣ Assigned by Admin
    const adminProjects = await Project.find({
      assignedEmployees: employeeId,
    })
      .populate("managers", "name email employeeId designation department")
      .populate(
        "assignedEmployees",
        "name email employeeId designation department",
      );

    // 2️⃣ Assigned by Manager
    const teamAssignments = await Team.find({
      assignToProject: employeeId,
    }).populate({
      path: "project",
      populate: [
        {
          path: "managers",
          select: "name email employeeId designation department",
        },
        {
          path: "assignedEmployees",
          select: "name email employeeId designation department",
        },
      ],
    });

    const teamProjects = teamAssignments.map((t) => t.project).filter(Boolean);

    // 3️⃣ Manager projects
    const managerProjects = await Project.find({
      managers: employeeId,
    })
      .populate("managers", "name email employeeId designation department")
      .populate(
        "assignedEmployees",
        "name email employeeId designation department",
      );

    // 4️⃣ Merge + remove duplicates
    const projectMap = new Map();

    [...adminProjects, ...teamProjects, ...managerProjects].forEach((p) => {
      projectMap.set(p._id.toString(), p);
    });

    // 5️⃣ Frontend-ready response
    // const projects = Array.from(projectMap.values()).map(project => {
    //   const isManager = project.managers.some(
    //     m => m._id.toString() === employeeId
    //   );

    //   return {
    //     _id: project._id,
    //     projectCode: project.projectCode,
    //     name: project.name,
    //     clientName: project.clientName,
    //     startDate: project.startDate,
    //     endDate: project.endDate,
    //     dueDate: project.dueDate,
    //     priority: project.priority,
    //     progress: project.progressPercentage || 0,

    //     myRole: isManager ? "Project Manager" : "Team Member",

    //     // ✅ STATUS WITHOUT POPULATE
    //     status:
    //       project.derivedStatus ||
    //       project.manualStatus ||
    //       "In Progress",

    //     managers: project.managers.map(m => m.name)
    //   };
    // });

    const projects = Array.from(projectMap.values()).map((project) => {
      const isManager = project.managers.some(
        (m) => m._id.toString() === employeeId,
      );

      return {
        _id: project._id,
        projectCode: project.projectCode,
        name: project.name,
        clientName: project.clientName,
        startDate: project.startDate,
        endDate: project.endDate,
        dueDate: project.dueDate,
        priority: project.priority,
        progress: project.progressPercentage || 0,

        myRole: isManager ? "Project Manager" : "Team Member",

        // ✅ SINGLE SOURCE OF TRUTH
        status: project.status,

        // optional (who updated manually)
        manualStatusInfo: project.manualStatus
          ? {
              status: project.manualStatus,
              updatedAt: project.manualStatusUpdatedAt,
              updatedBy: project.manualStatusUpdatedBy?.name || null,
            }
          : null,

        managers: project.managers.map((m) => m.name),
      };
    });

    return res.status(200).json({
      success: true,
      count: projects.length,
      projects,
    });
  } catch (error) {
    console.error("EMPLOYEE PROJECT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.get("/projects/employees/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;

    const team = await Team.findOne({ project: projectId })
      .populate("assignToProject", "_id name email department")
      .select("assignToProject");

    if (!team) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: "No team assigned to this project",
      });
    }

    return res.status(200).json({
      success: true,
      count: team.assignToProject.length,
      data: team.assignToProject,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      data: [],
      message: error.message,
    });
  }
});

// START BREAK

const getTodayDateOnly = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

app.post("/api/break/start", authenticate, async (req, res) => {
  try {
    const { breakType, reason } = req.body;
    const employeeId = req.user._id;
    const today = getTodayDateOnly();

    let breakDoc = await Break.findOne({ employeeId, date: today });

    if (!breakDoc) {
      breakDoc = new Break({
        employeeId,
        date: today,
        breaks: [],
      });
    }

    // ❌ Prevent multiple active breaks
    const activeBreak = breakDoc.breaks.find((b) => !b.endTime);
    if (activeBreak) {
      return res.status(400).json({ message: "Break already in progress" });
    }

    breakDoc.breaks.push({
      type: breakType,
      reason: breakType === "Other" ? reason : "",
      startTime: new Date(),
    });

    await breakDoc.save();

    res.json({ message: "Break started successfully", breakDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to start break" });
  }
});

// END BREAK
app.post("/api/break/end", authenticate, async (req, res) => {
  try {
    const employeeId = req.user._id;
    const today = getTodayDateOnly();

    const breakDoc = await Break.findOne({ employeeId, date: today });

    if (!breakDoc) {
      return res.status(404).json({ message: "No break found for today" });
    }

    const activeBreak = breakDoc.breaks.find((b) => !b.endTime);
    if (!activeBreak) {
      return res.status(400).json({ message: "No active break found" });
    }

    activeBreak.endTime = new Date();

    const diffSeconds = Math.floor(
      (activeBreak.endTime - activeBreak.startTime) / 1000,
    );

    activeBreak.durationSeconds = diffSeconds;
    breakDoc.totalBreakSeconds += diffSeconds;

    await breakDoc.save();

    res.json({ message: "Break ended successfully", breakDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to end break" });
  }
});

// EMPLOYEE - GET MY BREAKS
app.get("/api/break/my", authenticate, async (req, res) => {
  try {
    const employeeId = req.user._id;

    const breaks = await Break.find({ employeeId }).sort({ date: -1 });

    res.json(breaks);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch breaks" });
  }
});

// ADMIN - GET EMPLOYEE BREAKS DATE WISE
app.get("/api/break/admin/:employeeId", authenticate, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { date } = req.query;

    const query = { employeeId };

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      query.date = d;
    }

    const breaks = await Break.find(query)
      .populate("employeeId", "name email")
      .sort({ date: -1 });

    res.json(breaks);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch employee breaks" });
  }
});

//Dipali Birthday mail trigger
// 1️ Test single user birthday
app.post("/test-birthday/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (!user.dob) {
      return res.status(400).json({
        success: false,
        error: "User has no date of birth set",
      });
    }

    // Call the birthday function
    await autoSendBirthdayEmail(user);

    res.status(200).json({
      success: true,
      message: `Birthday email process triggered for ${user.name}`,
      userEmail: user.email,
      dob: user.dob,
    });
  } catch (error) {
    console.error("Test birthday error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send birthday email",
      details: error.message,
    });
  }
});

// 2️ Check all birthdays today (without sending)
app.get("/check-birthdays-today", async (req, res) => {
  try {
    const today = new Date();

    const employees = await User.find({
      dob: { $ne: null, $exists: true },
      isDeleted: false,
    });

    const birthdayUsers = employees.filter((emp) => {
      const dob = new Date(emp.dob);
      return (
        dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth()
      );
    });

    res.json({
      success: true,
      date: today.toDateString(),
      totalEmployees: employees.length,
      birthdaysToday: birthdayUsers.length,
      employees: birthdayUsers.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        dob: u.dob,
        lastBirthdayEmail: u.lastBirthdayEmail,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 3️ Trigger birthday emails for all today's birthdays
app.post("/trigger-birthdays-today", async (req, res) => {
  try {
    const today = new Date();

    const employees = await User.find({
      dob: { $ne: null, $exists: true },
      isDeleted: false,
    });

    const birthdayUsers = employees.filter((emp) => {
      const dob = new Date(emp.dob);
      return (
        dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth()
      );
    });

    let sentCount = 0;
    const results = [];

    for (const user of birthdayUsers) {
      try {
        await autoSendBirthdayEmail(user);
        sentCount++;
        results.push({
          name: user.name,
          email: user.email,
          status: "sent",
        });
      } catch (err) {
        results.push({
          name: user.name,
          email: user.email,
          status: "failed",
          error: err.message,
        });
      }
    }

    res.json({
      success: true,
      date: today.toDateString(),
      birthdaysFound: birthdayUsers.length,
      emailsSent: sentCount,
      results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test announcement email - send only to Dipali
// app.post('/test-announcement-dipali', async (req, res) => {
//   try {
//     const announcementHtml = await birthdayAnnouncementTemplate('Adesh');

//     await transporter.sendMail({
//       from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
//       to: 'dipali@creativewebsolution.in',
//       subject: '🎂 Birthday Celebration - Adesh (TEST)',
//       html: announcementHtml
//     });

//     res.json({
//       success: true,
//       message: 'Test announcement email sent to Dipali',
//       sentTo: 'dipali@creativewebsolution.in'
//     });
//   } catch (error) {
//     res.status(500).json({
//       error: error.message
//     });
//   }
// });

// Updated function
async function autoSendBirthdayEmail(user) {
  const today = new Date();

  if (!user.dob) return;
  if (
    user.lastBirthdayEmail &&
    user.lastBirthdayEmail.toDateString() === today.toDateString()
  )
    return;

  const dob = new Date(user.dob);
  if (dob.getDate() !== today.getDate() || dob.getMonth() !== today.getMonth())
    return;

  user.lastBirthdayEmail = today;
  await user.save();

  console.log(` Happy Birthday to ${user.name}!`);

  const birthdayHtml = await birthdayTemplate(user.name);

  // 1️ SEND BIRTHDAY EMAIL TO THE EMPLOYEE
  try {
    await transporter.sendMail({
      from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "🎂 Happy Birthday! 🎉",
      html: birthdayHtml,
    });
    console.log(`📧 Birthday email sent to ${user.name}`);
  } catch (err) {
    console.error(` Birthday email failed for ${user.name}:`, err.message);
  }

  // 2️ SEND ANNOUNCEMENT EMAIL TO ALL OTHER EMPLOYEES
  try {
    // Get all employees except the birthday person
    const allEmployees = await User.find({
      _id: { $ne: user._id }, // Exclude birthday person
      isDeleted: false,
      email: { $exists: true, $ne: null },
    });

    console.log(
      `Sending birthday announcement to ${allEmployees.length} employees...`,
    );

    const announcementHtml = await birthdayAnnouncementTemplate(user.name);

    // Send announcement email to each employee
    for (const emp of allEmployees) {
      try {
        await transporter.sendMail({
          from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
          to: emp.email,
          subject: `🎂 Birthday Celebration - ${user.name}`,
          html: announcementHtml,
        });
        console.log(`    Announcement sent to ${emp.name} (${emp.email})`);
      } catch (emailErr) {
        console.error(`    Failed to send to ${emp.name}:`, emailErr.message);
      }
    }

    console.log(
      ` Birthday announcements sent to all ${allEmployees.length} employees!`,
    );
  } catch (err) {
    console.error(" Error sending birthday announcements:", err.message);
  }

  // // 3️ IN-APP NOTIFICATION FOR BIRTHDAY EMPLOYEE
  // try {
  //   await Notification.create({
  //     user: user._id,
  //     type: 'Birthday',
  //     message: " Happy Birthday! Wishing you a wonderful year ahead! ",
  //     createdAt: new Date()
  //   });
  // } catch (err) {
  //   console.error("Error creating birthday person notification:", err.message);
  // }

  // // 4️ IN-APP NOTIFICATION FOR ADMINS
  // try {
  //   const admins = await User.find({ role: "admin" });
  //   for (const admin of admins) {
  //     await Notification.create({
  //       user: admin._id,
  //       type: 'Birthday',
  //       message: ` Today is ${user.name}'s birthday!`,
  //       createdAt: new Date()
  //     });
  //   }
  // } catch (err) {
  //   console.error(" Error creating admin notifications:", err.message);
  // }

  // // 5️ IN-APP NOTIFICATION FOR MANAGER
  // try {
  //   if (user.reportingManager) {
  //     await Notification.create({
  //       user: user.reportingManager,
  //       type: 'Birthday',
  //       message: ` Your team member ${user.name} has a birthday today!`,
  //       createdAt: new Date()
  //     });
  //   }
  // } catch (err) {
  //   console.error(" Error creating manager notification:", err.message);
  // }
}

//-----------------------------Birthday-----------------------------------//
////--------------------------- Anniversary--------------------------------//
// Test endpoints for anniversary

app.get("/debug-check-templates", (req, res) => {
  res.json({
    anniversaryTemplate: {
      type: typeof anniversaryTemplate,
      isFunction: typeof anniversaryTemplate === "function",
      value: anniversaryTemplate,
    },
    anniversaryAnnouncementTemplate: {
      type: typeof anniversaryAnnouncementTemplate,
      isFunction: typeof anniversaryAnnouncementTemplate === "function",
      value: anniversaryAnnouncementTemplate,
    },
  });
});

// Check anniversaries today
app.get("/check-anniversaries-today", async (req, res) => {
  try {
    const today = new Date();

    const employees = await User.find({
      doj: { $ne: null, $exists: true },
      isDeleted: false,
    });

    const anniversaryUsers = employees
      .filter((emp) => {
        const doj = new Date(emp.doj);
        const years = today.getFullYear() - doj.getFullYear();
        return (
          doj.getDate() === today.getDate() &&
          doj.getMonth() === today.getMonth() &&
          years > 0
        );
      })
      .map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        doj: u.doj,
        years: today.getFullYear() - new Date(u.doj).getFullYear(),
        lastAnniversaryEmail: u.lastAnniversaryEmail,
      }));

    res.json({
      success: true,
      date: today.toDateString(),
      totalEmployees: employees.length,
      anniversariesToday: anniversaryUsers.length,
      employees: anniversaryUsers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Set test anniversary to today
app.patch("/test-set-anniversary/:userId", async (req, res) => {
  try {
    const today = new Date();
    const testDoj = new Date(2020, today.getMonth(), today.getDate()); // 5 years ago

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      {
        doj: testDoj,
        lastAnniversaryEmail: null,
      },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const years = today.getFullYear() - testDoj.getFullYear();

    res.json({
      success: true,
      message: `Set ${user.name}'s DOJ to ${years} years ago for testing`,
      doj: user.doj,
      years: years,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test single anniversary
app.post("/test-anniversary/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (!user.doj) {
      return res.status(400).json({
        success: false,
        error: "User has no date of joining set",
      });
    }

    const today = new Date();
    const doj = new Date(user.doj);
    const years = today.getFullYear() - doj.getFullYear();

    if (
      doj.getDate() !== today.getDate() ||
      doj.getMonth() !== today.getMonth()
    ) {
      return res.status(400).json({
        success: false,
        error: "Today is not this user's anniversary",
        message: `${user.name}'s anniversary is on ${doj.toLocaleDateString(
          "en-US",
          { month: "long", day: "numeric" },
        )}, but today is ${today.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
        })}`,
        userAnniversary: doj.toISOString().split("T")[0],
        todayDate: today.toISOString().split("T")[0],
      });
    }

    if (years === 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot send anniversary email on joining date (0 years)",
      });
    }

    console.log(
      ` Testing anniversary email for: ${user.name} (${years} years)`,
    );

    await autoSendAnniversaryEmail(user);

    res.status(200).json({
      success: true,
      message: `Anniversary email process triggered for ${user.name}`,
      userEmail: user.email,
      doj: user.doj,
      years: years,
    });
  } catch (error) {
    console.error(" Test anniversary error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send anniversary email",
      details: error.message,
    });
  }
});

//testing done
// Auto send anniversary email function
async function autoSendAnniversaryEmail(user) {
  const today = new Date();

  if (!user.doj) return;

  // Check if already sent today
  if (
    user.lastAnniversaryEmail &&
    user.lastAnniversaryEmail.toDateString() === today.toDateString()
  )
    return;

  const doj = new Date(user.doj);

  // Check if today matches anniversary date (month and day)
  if (doj.getDate() !== today.getDate() || doj.getMonth() !== today.getMonth())
    return;

  // Calculate years
  const years = today.getFullYear() - doj.getFullYear();

  // Don't send on joining date (0 years)
  if (years === 0) return;

  // Update last sent date
  user.lastAnniversaryEmail = today;
  await user.save();

  console.log(` Work Anniversary: ${user.name} - ${years} years!`);

  const anniversaryHtml = await anniversaryTemplate(user.name, years);

  // 1️ SEND ANNIVERSARY EMAIL TO THE EMPLOYEE
  try {
    await transporter.sendMail({
      from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `🎉 Happy ${years} Year Work Anniversary! 🎊`,
      html: anniversaryHtml,
    });
    console.log(` Anniversary email sent to ${user.name}`);
  } catch (err) {
    console.error(` Anniversary email failed for ${user.name}:`, err.message);
  }

  // 2️ SEND ANNOUNCEMENT EMAIL TO ALL OTHER EMPLOYEES
  try {
    const allEmployees = await User.find({
      _id: { $ne: user._id },
      isDeleted: false,
      email: { $exists: true, $ne: null },
    });

    console.log(
      ` Sending anniversary announcement to ${allEmployees.length} employees...`,
    );

    const announcementHtml = await anniversaryAnnouncementTemplate(
      user.name,
      years,
    );

    for (const emp of allEmployees) {
      try {
        await transporter.sendMail({
          from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
          to: emp.email,
          subject: ` Work Anniversary - ${user.name} (${years} ${
            years === 1 ? "Year" : "Years"
          })`,
          html: announcementHtml,
        });
        console.log(`    Announcement sent to ${emp.name} (${emp.email})`);
      } catch (emailErr) {
        console.error(`    Failed to send to ${emp.name}:`, emailErr.message);
      }
    }

    console.log(
      ` Anniversary announcements sent to all ${allEmployees.length} employees!`,
    );
  } catch (err) {
    console.error(" Error sending anniversary announcements:", err.message);
  }

  // // 3️ IN-APP NOTIFICATION FOR ANNIVERSARY EMPLOYEE
  // try {
  //   await Notification.create({
  //     user: user._id,
  //     type: 'Anniversary',
  //     message: ` Congratulations on completing ${years} ${years === 1 ? 'year' : 'years'} with us! Thank you for your dedication!`
  //   });
  //   console.log(` Anniversary notification created for ${user.name}`);
  // } catch (err) {
  //   console.error(" Error creating anniversary notification:", err.message);
  // }

  // // 4️ IN-APP NOTIFICATION FOR ADMINS
  // try {
  //   const admins = await User.find({ role: "admin" });
  //   for (const admin of admins) {
  //     await Notification.create({
  //       user: admin._id,
  //       type: 'Anniversary',
  //       message: ` ${user.name} is celebrating ${years} ${years === 1 ? 'year' : 'years'} work anniversary today!`
  //     });
  //   }
  //   console.log(` Anniversary notifications created for ${admins.length} admins`);
  // } catch (err) {
  //   console.error(" Error creating admin notifications:", err.message);
  // }

  // // 5️ IN-APP NOTIFICATION FOR MANAGER
  // try {
  //   if (user.reportingManager) {
  //     await Notification.create({
  //       user: user.reportingManager,
  //       type: 'Anniversary',
  //       message: `🎉 Your team member ${user.name} has completed ${years} ${years === 1 ? 'year' : 'years'} with the company today!`
  //     });
  //     console.log(` Anniversary notification created for manager`);
  //   }
  // } catch (err) {
  //   console.error(" Error creating manager notification:", err.message);
  // }
}

////--------------------------- Anniversary--------------------------------//

// ✅ Create Policy (POST)
app.post("/policy/create", upload.single("pdf"), async (req, res) => {
  try {
    const { title, description } = req.body; //remove image from this ---------shivani

    // Validation
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });
    }

    // Create policy
    const policy = new Policy({
      title,
      description,
      image: req.file ? req.file.path : null, // rutuja 03-04-26
    });

    const savedPolicy = await policy.save();
    // added by shivani

    const allowedRoles = ["employee", "IT_Support", "ceo", "md","Team_Leader","manager","coo"];

    const users = await User.find({ role: { $in: allowedRoles } }).select("_id");

    //  Create notifications
    const notifications = users.map((user) => ({
      user: user._id,
      type: "Policy",
      message: `New  policy published: ${title}`,
      triggeredByRole: "HR",
      announcementRef: savedPolicy._id, // you can rename to policyRef later
      isRead: false,
      createdAt: new Date(),
    }));
   await Notification.insertMany(notifications);

    res.status(201).json({
      success: true,
      message: "Policy created successfully",
      data: savedPolicy,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

//Added by Shivani
app.put(
  "/policy/update/:id",
  upload.single("pdf"), // allow PDF upload
  async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description } = req.body;

      if (!title || !description) {
        return res.status(400).json({
          success: false,
          message: "Title and description are required",
        });
      }

      // ✅ Prepare update object
      const updateData = {
        title,
        description,
      };

      // ✅ If new file uploaded, update image/pdf
      if (req.file) {
        updateData.image = req.file ? req.file.path : null; //rutuja 03-04-26
        // or req.file.path / req.file.secure_url (Cloudinary)
      }

      const updatedPolicy = await Policy.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );

      if (!updatedPolicy) {
        return res.status(404).json({
          success: false,
          message: "Policy not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Policy updated successfully",
        data: updatedPolicy,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// DELETE policy
app.delete("/policy/delete/:id", async (req, res) => {
  console.log("DELETE policy route loaded");
  try {
    const { id } = req.params;

    const deletedPolicy = await Policy.findByIdAndDelete(id);

    if (!deletedPolicy) {
      return res.status(404).json({
        success: false,
        message: "Policy not found",
      });
    }

    await Notification.deleteMany({ announcementRef: id });

    res.status(200).json({
      success: true,
      message: "Policy deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// GET all policies
app.get("/policy/get", async (req, res) => {
  try {
    const { employeeId } = req.query;

    const policies = await Policy.find().sort({ createdAt: -1 });//rutuja 03-04-26

    if (!employeeId) {
      return res.json({
        success: true,
        data: policies,
      });
    }

    const acknowledgements = await PolicyAcknowledgement.find({
      employeeId,
    });

    const acknowledgedPolicyIds = acknowledgements.map(
      (a) => a.policyId.toString()
    );

    const updatedPolicies = policies.map((policy) => ({
      ...policy._doc,
      isRead: acknowledgedPolicyIds.includes(policy._id.toString()),
    }));

    res.json({
      success: true,
      data: updatedPolicies,
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

//HR Feedback Rutuja
const canSendMessage = (
  senderRole,
  receiverRole,
  senderId,
  receiverReportingManager,
) => {
  const sender = senderRole;
  const receiver = receiverRole;
  // 1. HR can send to anyone
  if (sender === "hr") {
    return true;
  }

  if (sender === "admin") {
    return true;
  }
  //rutuja
  //  4. NEW: Employee can send to their Manager
  // if (sender === "employee" && receiver === "manager") {
  //   return true;
  // }
  //  5. NEW: Manager can send to their direct reports
  // if (
  //   sender === "manager" &&
  //   receiverReportingManager &&
  //   receiverReportingManager.toString() === senderId.toString()
  // ) {
  //   return true;
  // }

  // 3. Employee/Manager can send to HR/Admin
  if (sender === "employee") {
    return receiver === "hr" || receiver === "admin";
  }
  
  if (sender === "manager") {
    return (
      receiver === "hr" ||
      receiver === "admin" ||
      receiver === "Team_Leader" 
    );
  }

    // 4. tl send feedback to hr and team member
    if (sender === "Team_Leader") {
      if (receiver === "hr" || receiver === "admin") {
        return true;
      }
      if (receiver === "employee") {
        return true;
      }
      if (receiver === "manager") {
        return true;
      }
      return false;
    }
  

  return false;
};


app.post("/feedback/send", authenticate, async (req, res) => {
  try {
    const { receiverId, title, message } = req.body;

    const sender = await User.findById(req.user._id);
    const receiver = await User.findById(receiverId).select(
      "role name reportingManager",
    ); ///dip code

    if (!receiverId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "Receiver, title and message are required",
      });
    }

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "Receiver not found",
      });
    }

    if (
      !canSendMessage(
        sender.role,
        receiver.role,
        req.user._id,
        receiver.reportingManager,
      )
    ) {
      //rutuja
      // const senderRole = sender.role.toLowerCase();
      // if (senderRole === "employee" || senderRole === "manager") {
      //   return res.status(403).json({
      //     success: false,
      //     message:
      //       "You can only send feedback to HR, your manager, or your direct reports",
      //   });
      // } 
      if (sender.role.toLowerCase() === "employee") {
        return res.status(403).json({
          success: false,
          message: "Employees can only send feedback to HR",
        });
      }
      else {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to send feedback",
        });
      }
    }

    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot send feedback to yourself",
      });
    }

    const lastFeedback = await Feedback.findOne().sort({ createdAt: -1 });
    let nextNumber = 1;
    if (lastFeedback && lastFeedback.feedbackId) {
      const lastIdNum =
        parseInt(lastFeedback.feedbackId.replace("FED", "")) || 0;
      nextNumber = lastIdNum + 1;
    }
    const feedbackId = `FED${nextNumber}`;

    const feedback = new Feedback({
      feedbackId: feedbackId,
      sender: req.user._id,
      receiver: receiverId,
      title: title.trim(),
      message: message.trim(),
    });

    await feedback.save();

    const populatedFeedback = await Feedback.findById(feedback._id)
      .populate("sender", "name email role designation")
      .populate("receiver", "name email role designation");

    // const receiverSocketId = onlineUsers.get(receiverId);
    // if (receiverSocketId) {
    //   io.to(receiverSocketId).emit("new-feedback", populatedFeedback);
    // }

    let finalRole = sender.role.toUpperCase();
    if (sender.role === "Team_Leader") finalRole = "Team_Leader";
    if (sender.role === "IT_Support") finalRole = "IT_Support";

    try {
      await Notification.create({
        user: receiverId,
        type: "Feedback",
        message: `You have received new feedback from ${sender.name} (${sender.role})`,
        feedbackRef: feedback._id,
        isRead: false,
        triggeredByRole: finalRole, 
        createdAt: new Date(),
      });
    } catch (error) {
      console.error("Error creating notification:", error);
    }

    res.status(201).json({
      success: true,
      message: "Feedback sent successfully",
      feedback: populatedFeedback,
    });
  } catch (err) {
    console.error("Send feedback error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});


app.get("/feedback/employee/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("name role email");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const feedbacks = await Feedback.find({
      $or: [{ sender: id }, { receiver: id }],
    })
      .sort({ createdAt: -1 })
      .populate("sender", "name role designation")
      .populate("receiver", "name role designation");

    res.status(200).json({
      success: true,
      employee: user,
      totalFeedback: feedbacks.length,
      feedbacks: feedbacks,
    });
  } catch (err) {
    console.error("Employee feedback error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.put("/feedback/view/:feedbackId", authenticate, async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.feedbackId);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    if (feedback.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned receiver can mark feedback as viewed",
      });
    }

    const receiver = await User.findById(req.user._id).select("name role");
    feedback.status = "viewed";
    feedback.readAt = new Date();
    await feedback.save();

    let finalRole = receiver.role.toUpperCase();
    if (receiver.role === "Team_Leader") finalRole = "Team_Leader";
    if (receiver.role === "IT_Support") finalRole = "IT_Support";

    try {
      await Notification.create({
        user: feedback.sender,
        type: "Feedback Viewed",
        message: `Your feedback to ${receiver.name}(${receiver.role})has been viewed`,
        feedbackRef: feedback._id,
        isRead: false,
        triggeredByRole: finalRole,
        createdAt: new Date(),
      });
    } catch (notificationError) {
      console.error("Error creating sender notification:", notificationError);
    }

    // const senderSocketId = onlineUsers.get(feedback.sender.toString());
    // if (senderSocketId) {
    //   io.to(senderSocketId).emit("feedback-viewed", {
    //     feedbackId: feedback._id,
    //     status: feedback.status,
    //     readAt: feedback.readAt
    //   });
    // }

    res.status(200).json({
      success: true,
      message: "Feedback marked as viewed",
      feedback: {
        _id: feedback._id,
        feedbackId: feedback.feedbackId,
        status: feedback.status,
        readAt: feedback.readAt,
      },
    });
  } catch (err) {
    console.error("Mark as viewed error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});

app.put("/feedback/edit/:feedbackId", authenticate, async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { title, message } = req.body;

    if (!title && !message) {
      return res.status(400).json({
        success: false,
        message: "Title or message required for editing",
      });
    }

    const feedback = await Feedback.findById(feedbackId);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    if (feedback.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the sender can edit feedback",
      });
    }

    if (feedback.status === "viewed") {
      return res.status(400).json({
        success: false,
        message: "Cannot edit feedback that has been viewed",
      });
    }

    if (title) feedback.title = title.trim();
    if (message) feedback.message = message.trim();

    await feedback.save();

    const populatedFeedback = await Feedback.findById(feedbackId)
      .populate("sender", "name role designation")
      .populate("receiver", "name role designation");

    res.status(200).json({
      success: true,
      message: "Feedback updated successfully",
      feedback: populatedFeedback,
    });
  } catch (err) {
    console.error("Edit feedback error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});

app.get("/gethr", authenticate, async (req, res) => {
  try {
    const hrPersons = await User.find({
      role: "hr",
    }).select("_id name role");

    res.json({
      success: true,
      hrPersons,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/feedback/delete/:id", authenticate, async (req, res) => {
  try {
    const feedbackId = req.params.id;

    const feedback = await Feedback.findById(feedbackId);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: "Feedback not found",
      });
    }

    if (
      feedback.sender.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Only the sender can delete feedback",
      });
    }

    try {
      await Notification.deleteOne({
        feedbackRef: feedbackId,
        type: "Feedback",
      });
    } catch (error) {
      console.error("Error deleting associated notification:", error);
    }

    await Feedback.findByIdAndDelete(feedbackId);

    res.status(200).json({
      success: true,
      message: "Feedback deleted successfully",
      deletedFeedback: {
        _id: feedback._id,
        feedbackId: feedback.feedbackId,
        title: feedback.title,
        sender: feedback.sender,
        receiver: feedback.receiver,
        deletedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("Delete feedback error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});

//get all feedback for admin view
app.get("/feedback/all", async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .sort({ createdAt: -1 })
      .populate("sender", "name email role designation employeeId")
      .populate("receiver", "name email role designation employeeId");

    res.status(200).json({
      success: true,
      count: feedbacks.length,
      feedbacks: feedbacks,
    });
  } catch (err) {
    console.error("Get all feedback error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});

//////////end feedback Rutuja
/// shivani employee report
app.get("/api/tasks/employee/:employeeId/delayed-tasks", async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employeeId",
      });
    }

    const delayedStatus = await Status.findOne({
      name: { $regex: /^delayed$/i },
    });

    if (!delayedStatus) {
      return res.status(404).json({
        success: false,
        message: "Delayed status not found",
      });
    }

    const delayedTasks = await Task.find({
      assignedTo: employeeId,
      status: delayedStatus._id,
    })
      .populate("status", "name")
      .select("taskName projectName dateOfExpectedCompletion status");

    res.status(200).json({
      success: true,
      count: delayedTasks.length,
      tasks: delayedTasks.map((task) => ({
        id: task._id,
        project: task.projectName,
        title: task.taskName,
        dueDate: task.dateOfExpectedCompletion,
        status: task.status?.name,
      })),
    });
  } catch (error) {
    console.error("Delayed Task API Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch delayed tasks",
    });
  }
});

app.get("/api/tasks/employee/:employeeId/upcoming-tasks", async (req, res) => {
  try {
    const { employeeId } = req.params;

    const empObjectId = new mongoose.Types.ObjectId(employeeId); // ✅ FIX

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    nextWeek.setHours(23, 59, 59, 999);

    const tasks = await Task.find({
      assignedTo: empObjectId, // ✅ ObjectId match
      dateOfTaskAssignment: {
        $gte: today,
        $lte: nextWeek,
      },
    })
      .populate("status", "name")
      .sort({ dateOfTaskAssignment: 1 });

    const formattedTasks = tasks.map((task) => ({
      id: task._id,
      title: task.taskName,
      project: task.projectName,
      startDate: task.dateOfTaskAssignment,
      dueDate: task.dateOfExpectedCompletion,
      status: task.status?.name || "Pending",
    }));

    res.json({
      success: true,
      count: formattedTasks.length,
      tasks: formattedTasks,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/reports/employee/:employeeId/projects", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const empId = new mongoose.Types.ObjectId(employeeId);

    const projects = await Project.find({
      assignedEmployees: { $in: [empId] }, // ✅ FIXED
    })
      .populate("status", "name")
      .select("name status dueDate")
      .sort({ dueDate: 1 });

    const today = new Date();

    const projectData = projects.map((proj) => ({
      id: proj._id,
      name: proj.name,
      status: proj.status?.name || "Unknown", // string
      deliveryDate: proj.dueDate,
      isDelayed:
        proj.dueDate &&
        new Date(proj.dueDate) < today &&
        proj.status?.name !== "Completed",
    }));

    res.json({
      success: true,
      count: projectData.length,
      projects: projectData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/employee/:employeeId/teams", async (req, res) => {
  try {
    const { employeeId } = req.params;

    // ✅ convert string → ObjectId
    const empObjectId = new mongoose.Types.ObjectId(employeeId);

    // ✅ match ObjectId inside array
    const teams = await Team.find({
      assignToProject: { $in: [empObjectId] },
    })
      .populate("assignToProject", "name email designation contact") // employees
      .populate("project", "name") // project name
      .select("name project assignToProject"); // only needed fields

    res.status(200).json({
      success: true,
      count: teams.length,
      data: teams,
    });
  } catch (error) {
    console.error("Team API Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/////Manager task edit delete
app.put("/api/task/:id", upload.single("documents"), async (req, res) => {
  try {
    const taskId = req.params.id;

    // 1️⃣ Find existing task
    const task = await Task.findById(taskId);
    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    // 2️⃣ Prepare update object (only overwrite provided fields)
    const updates = {
      taskName: req.body.taskName ?? task.taskName,
      projectName: req.body.projectName ?? task.projectName,
      assignedTo: req.body.assignedTo || task.assignedTo,
      department: req.body.department ?? task.department,
      taskDescription: req.body.taskDescription ?? task.taskDescription,
      typeOfTask: req.body.typeOfTask ?? task.typeOfTask,
      dateOfTaskAssignment:
        req.body.dateOfTaskAssignment ?? task.dateOfTaskAssignment,
      dateOfExpectedCompletion:
        req.body.dateOfExpectedCompletion ?? task.dateOfExpectedCompletion,
      progressPercentage:
        req.body.progressPercentage ?? task.progressPercentage,
      // comments: req.body.comments ?? task.comments,
      // status: req.body.status ?? task.status,
    };

    if (req.body.comments !== undefined) {
      updates.comments = [{ text: req.body.comments, createdAt: new Date() }];
    }

    // ✅ status fix (ObjectId only)
    if (req.body.status && req.body.status.length === 24) {
      updates.status = req.body.status;
    }
    // 3️⃣ If new document uploaded → delete old & replace
    if (req.file) {
      if (task.documents?.public_id) {
        await cloudinary.uploader.destroy(task.documents.public_id, {
          resource_type: task.documents.resource_type || "raw",
        });
      }

      updates.documents = {
        url: req.file.path,
        public_id: req.file.filename,
        resource_type: req.file.resource_type,
      };
    }

    // 4️⃣ Update task
    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      { $set: updates },
      { new: true },
    ).populate("assignedTo status");

    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      task: updatedTask,
    });
  } catch (error) {
    console.error("Edit Task Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update task",
    });
  }
});

//added by Rutuja for project comments
app.post("/project/:projectId/comment", authenticate, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { comment } = req.body;
    const userId = req.user._id;

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot be empty",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (!Array.isArray(project.comments)) {
      project.comments = [];
    }

    project.comments.push({
      text: comment.trim(),
      user: userId,
      createdAt: new Date(),
    });

    await project.save();

    const commenter = await User.findById(userId).select("name role");

    const targetRoles = ["hr", "admin", "ceo", "coo", "manager", "md", "Team_Leader"];
    const usersToNotify = await User.find({
      role: { $in: targetRoles },
      _id: { $ne: userId },
    });

    for (const user of usersToNotify) {
      await TaskNotification.create({
        user: user._id,
        type: "Project_comment",
        message: `${commenter.name} (${commenter.role}) added comment on project "${project.name}"`,
        projectRef: project._id,
        isRead: false,
      });
    }

    if (project.managers && project.managers.length > 0) {
      for (const managerId of project.managers) {
        if (managerId.toString() !== userId.toString()) {
          await TaskNotification.create({
            user: managerId,
            type: "Project_comment",
            message: `${commenter.name} (${commenter.role}) added comment on your project "${project.name}"`,
            projectRef: project._id,
            isRead: false,
          });
        }
      }
    }

    const sortedComments = project.comments.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      commentId: project.comments[project.comments.length - 1]._id,
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get all comments for a project
app.get("/project/:projectId/comments", async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const project = await Project.findById(projectId)
      .populate({
        path: "comments.user",
        select: "name email role ",
      })
      .select("comments");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.status(200).json({
      success: true,
      count: project.comments?.length || 0,
      comments: project.comments || [],
    });
  } catch (error) {
    console.error("Error getting comments:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});
app.delete(
  "/project/:projectId/comment/:commentId",
  authenticate,
  async (req, res) => {
    try {
      const { projectId, commentId } = req.params;
      const userId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid project ID",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(commentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid comment ID",
        });
      }

      const project = await Project.findById(projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      if (!Array.isArray(project.comments) || project.comments.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No comments found",
        });
      }

      const commentIndex = project.comments.findIndex(
        (comment) => comment._id.toString() === commentId,
      );

      if (commentIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Comment not found",
        });
      }

      const comment = project.comments[commentIndex];

      if (!comment.user || comment.user.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to delete this comment",
        });
      }

      project.comments.splice(commentIndex, 1);

      await project.save();

      res.status(200).json({
        success: true,
        message: "Comment deleted successfully",
        deletedCommentId: commentId,
      });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);
app.put(
  "/project/:projectId/comment/:commentId",
  authenticate,
  async (req, res) => {
    try {
      const { projectId, commentId } = req.params;
      const { comment } = req.body;
      const userId = req.user._id;

      if (!comment || !comment.trim()) {
        return res.status(400).json({
          success: false,
          message: "Comment cannot be empty",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(projectId) ||
        !mongoose.Types.ObjectId.isValid(commentId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid project ID or comment ID",
        });
      }

      const project = await Project.findById(projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }

      if (!Array.isArray(project.comments) || project.comments.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Comment not found",
        });
      }

      const commentIndex = project.comments.findIndex(
        (c) =>
          c._id.toString() === commentId &&
          c.user.toString() === userId.toString(),
      );

      if (commentIndex === -1) {
        const commentExists = project.comments.some(
          (c) => c._id.toString() === commentId,
        );

        if (commentExists) {
          return res.status(403).json({
            success: false,
            message: "You can only edit your own comments",
          });
        } else {
          return res.status(404).json({
            success: false,
            message: "Comment not found",
          });
        }
      }

      project.comments[commentIndex].text = comment.trim();
      project.comments[commentIndex].updatedAt = new Date();
      project.comments[commentIndex].isEdited = true;

      await project.save();

      const commenter = await User.findById(userId).select("name role");

      const updatedComment = project.comments[commentIndex];

      res.status(200).json({
        success: true,
        message: "Comment updated successfully",
        comment: {
          _id: updatedComment._id,
          text: updatedComment.text,
          user: updatedComment.user,
          createdAt: updatedComment.createdAt,
          updatedAt: updatedComment.updatedAt,
          isEdited: updatedComment.isEdited,
        },
      });
    } catch (error) {
      console.error("Error editing comment:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
);

//rutuja end comment

// start task time
app.post("/task/:taskId/start", async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (task.timeTracking && task.timeTracking.isRunning) {
      return res.status(400).json({
        success: false,
        message: "Timer is already start",
      });
    }

    const now = new Date();
    if (!task.timeTracking) {
      task.timeTracking = {
        isRunning: true,
        startTime: now,
        totalSeconds: 0,
        timeEntries: [],
      };
    } else {
      task.timeTracking.isRunning = true;
      task.timeTracking.startTime = now;
    }

    task.timeTracking.timeEntries.push({
      startTime: now,
      endTime: null,
      duration: 0,
    });

    await task.save();

    res.json({
      success: true,
      message: "Task time start.",
      taskId: task._id,
      taskName: task.taskName,
      startTime: now,
      projectName: task.projectName,
    });
  } catch (error) {
    console.error("error time start:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

//stop task time
app.post("/task/:taskId/stop", async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (!task.timeTracking || !task.timeTracking.isRunning) {
      return res.status(400).json({
        success: false,
        message: "Timer is not start",
      });
    }

    const endTime = new Date();
    const startTime = task.timeTracking.startTime;
    const durationSeconds = Math.floor((endTime - startTime) / 1000);

    const lastEntryIndex = task.timeTracking.timeEntries.length - 1;
    task.timeTracking.timeEntries[lastEntryIndex].endTime = endTime;
    task.timeTracking.timeEntries[lastEntryIndex].duration = durationSeconds;

    task.timeTracking.totalSeconds += durationSeconds;
    task.timeTracking.isRunning = false;
    task.timeTracking.startTime = null;

    await task.save();

    const totalHours = (task.timeTracking.totalSeconds / 3600).toFixed(2);
    const sessionHours = (durationSeconds / 3600).toFixed(2);

    res.json({
      success: true,
      message: "Task timer stop",
      taskId: task._id,
      taskName: task.taskName,
      currentSession: {
        duration: durationSeconds,
        hours: sessionHours,
        formatted: `${Math.floor(durationSeconds / 3600)}h ${Math.floor(
          (durationSeconds % 3600) / 60,
        )}m ${durationSeconds % 60}s`,
      },
      totalTime: {
        totalSeconds: task.timeTracking.totalSeconds,
        hours: totalHours,
        formatted: `${Math.floor(
          task.timeTracking.totalSeconds / 3600,
        )}h ${Math.floor((task.timeTracking.totalSeconds % 3600) / 60)}m ${
          task.timeTracking.totalSeconds % 60
        }s`,
      },
    });
  } catch (error) {
    console.error("Stop timer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// app.get("/bench-employees", authenticate, async (req, res) => {
//   try {
//     const role = req.user.role;
//     const userId = req.user._id;

//     let employees = [];

//     if (["admin", "ceo", "hr", "coo", "md"].includes(role)) {
//       employees = await User.find(
//         {},
//         {
//           name: 1,
//           designation: 1,
//           department: 1,
//           email: 1,
//           employeeId: 1,
//           doj: 1,
//           contact: 1,
//         },
//       );
//     } else if (role === "manager") {
//       employees = await User.find(
//         { reportingManager: userId },
//         {
//           name: 1,
//           designation: 1,
//           department: 1,
//           email: 1,
//           employeeId: 1,
//           doj: 1,
//           contact: 1,
//         },
//       );
//     } else {
//       return res.status(403).json({ success: false, message: "Forbidden" });
//     }

//     const teams = await Team.find({}, { assignToProject: 1 });

//     const assignedEmployeeIds = new Set();
//     teams.forEach((team) => {
//       (team.assignToProject || []).forEach((empId) =>
//         assignedEmployeeIds.add(empId.toString()),
//       );
//     });

//     const benchEmployees = employees.filter(
//       (emp) => !assignedEmployeeIds.has(emp._id.toString()),
//     );

//     res.status(200).json({
//       success: true,
//       count: benchEmployees.length,
//       benchEmployees,
//     });
//   } catch (error) {
//     console.error("Error fetching bench employees:", error);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// });

app.get("/bench-employees", authenticate, async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user._id;

    let employees = [];

    // FOR ADMIN/HR/CEO/COO/MD → fetch all employees
    if (["admin", "ceo", "hr", "coo", "md"].includes(role)) {
      employees = await User.find(
        { role: ["employee"], isDeleted: { $ne: true } }, // only employees added harshada
        {
          name: 1,
          designation: 1,
          department: 1,
          email: 1,
          employeeId: 1,
          doj: 1,
          contact: 1,
          role: 1,
        },
      );
    }

    // FOR MANAGER → fetch reporting employees only
    else if (role === "manager") {
      employees = await User.find(
        { reportingManager: userId, role: "employee" }, // only employees under manager added harshada
        {
          name: 1,
          designation: 1,
          department: 1,
          email: 1,
          employeeId: 1,
          doj: 1,
          contact: 1,
          role: 1,
        },
      );
    } else {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    // Fetch teams to check assignment
    const teams = await Team.find({}, { assignToProject: 1 });

    const assignedEmployeeIds = new Set();
    teams.forEach((team) => {
      (team.assignToProject || []).forEach((empId) =>
        assignedEmployeeIds.add(empId.toString()),
      );
    });

    // Filter bench employees → NOT assigned
    const benchEmployees = employees.filter(
      (emp) => !assignedEmployeeIds.has(emp._id.toString()), //added harshada
    );

    res.status(200).json({
      success: true,
      count: benchEmployees.length,
      benchEmployees,
    });
  } catch (error) {
    console.error("Error fetching bench employees:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

//Rutuja
// get emp info
app.get("/emp/info/:empId", async (req, res) => {
  try {
    const emp = await User.findOne({ employeeId: req.params.empId })
      .select("employeeId name designation department doj")
      .populate("reportingManager", "name");

    if (!emp) return res.status(404).json({ message: "Employee not found" });

    res.json({
      empId: emp.employeeId,
      name: emp.name,
      designation: emp.designation,
      department: emp.department,
      manager: emp.reportingManager
        ? emp.reportingManager.name
        : "Not assigned",
      joiningDate: emp.doj ? emp.doj.toISOString().split("T")[0] : "N/A",
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

//emp apply resignation
app.post("/resignation/apply", authenticate, async (req, res) => {
  try {
    const { reason, comments } = req.body;

    if (!reason) {
      return res.status(400).json({ message: "Reason is required" });
    }

    const validReasons = [
      "Career Growth",
      "Personal Reason",
      "Higher Studies",
      "Health Issue",
      "Relocation",
      "Other",
    ];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ message: "Invalid reason" });
    }

    const emp = await User.findById(req.user._id);
    if (!emp) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const endOfMonth = new Date();
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);
        endOfMonth.setDate(0);
        endOfMonth.setHours(23, 59, 59, 999);

        //  Count resignations in current month
        const monthlyCount = await Resignation.countDocuments({
          employee: emp._id,
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        });

        //  Restrict if already applied 3 times
        if (monthlyCount >= 3) {
          return res.status(400).json({
            message: "You can apply for resignation only 3 times in a month",
          });
        }

    const existing = await Resignation.findOne({
      employee: emp._id,
      status: "Pending",
    });

    if (existing) {
      return res.status(400).json({
        message: "Already have pending resignation",
      });
    }

    const lastResignation = await Resignation.findOne().sort({
      resignationId: -1,
    });
    let nextNumber = 1;

    if (lastResignation && lastResignation.resignationId) {
      const lastNumber = parseInt(
        lastResignation.resignationId.replace("RES", ""),
      );
      nextNumber = lastNumber + 1;
    }

    const resignationId = `RES${String(nextNumber).padStart(3, "0")}`;

    const resignation = new Resignation({
      resignationId,
      employee: emp._id,
      reason,
      comments: comments || "",
    });

    await resignation.save();
    //Added by shivani
   
    try {
      const notifications = [];
      const userRole = emp.role;
      const finalRole = userRole === "Team_Leader" ? "Team_Leader" : userRole.toUpperCase();

      if (userRole === "hr") {
        const notifyUsers = await User.find({
          role: { $in: ["md", "admin", "ceo", "coo"] },
          isDeleted: false
        });

        for (const user of notifyUsers) {
          notifications.push({
            user: user._id,
            type: "Resignation",
            message: `${emp.name}(${emp.employeeId})- HR has applied for resignation.`,
            isRead: false,
            createdAt: new Date(),
            triggeredBy: emp._id,
            triggeredByRole: finalRole,
          });
        }
      }
      
      else if (userRole === "IT_Support") {
        const notifyRoles = ["hr", "md", "admin", "ceo", "coo"];
        const notifyUsers = await User.find({
          role: { $in: notifyRoles },
          isDeleted: false
        });

        for (const user of notifyUsers) {
          notifications.push({
            user: user._id,
            type: "Resignation",
            message: `${emp.name} (${emp.employeeId}) has applied for resignation.`,
            isRead: false,
            createdAt: new Date(),
            triggeredBy: emp._id,
            triggeredByRole: finalRole,
          });
        }

        if (emp.reportingManager) {
          notifications.push({
            user: emp.reportingManager,
            type: "Resignation",
            message: `${emp.name} (${emp.employeeId}) has applied for resignation.`,
            isRead: false,
            createdAt: new Date(),
            triggeredBy: emp._id,
            triggeredByRole: finalRole,
          });
        }
      }
      
      else if (userRole === "manager") {
        const notifyUsers = await User.find({
          role: { $in: ["hr", "admin", "ceo", "coo", "md"] },
          isDeleted: false
        });

        for (const user of notifyUsers) {
          notifications.push({
            user: user._id,
            type: "Resignation",
            message: `${emp.name}(${emp.employeeId})- Manager has applied for resignation.`,
            isRead: false,
            createdAt: new Date(),
            triggeredBy: emp._id,
            triggeredByRole: finalRole,
          });
        }
      }
      
      else if (userRole === "Team_Leader") {
        const notifyRoles = ["hr", "admin", "ceo", "coo", "md"];
        const notifyUsers = await User.find({
          role: { $in: notifyRoles },
          isDeleted: false
        });

        for (const user of notifyUsers) {
          notifications.push({
            user: user._id,
            type: "Resignation",
            message: `${emp.name} (${emp.employeeId})has applied for resignation.`,
            isRead: false,
            createdAt: new Date(),
            triggeredBy: emp._id,
            triggeredByRole: finalRole,
          });
        }

        if (emp.reportingManager) {
          notifications.push({
            user: emp.reportingManager,
            type: "Resignation",
            message: `${emp.name}(${emp.employeeId}) has applied for resignation.`,
            isRead: false,
            createdAt: new Date(),
            triggeredBy: emp._id,
            triggeredByRole: finalRole,
          });
        }
      }
      
      else {
        const notifyRoles = ["hr", "admin", "ceo", "coo", "md"];
        const notifyUsers = await User.find({
          role: { $in: notifyRoles },
          isDeleted: false
        });

        for (const user of notifyUsers) {
          notifications.push({
            user: user._id,
            type: "Resignation",
            message: `${emp.name} (${emp.employeeId}) has applied for resignation.`,
            isRead: false,
            createdAt: new Date(),
            triggeredBy: emp._id,
            triggeredByRole: finalRole,
          });
        }

        if (emp.reportingManager) {
          notifications.push({
            user: emp.reportingManager,
            type: "Resignation",
            message: `${emp.name}(${emp.employeeId}) has applied for resignation.`,
            isRead: false,
            createdAt: new Date(),
            triggeredBy: emp._id,
            triggeredByRole: finalRole,
          });
        }

        const teams = await Team.find({
          assignToProject: emp._id,
        }).select("teamLead");

        const uniqueTLs = new Set();
        teams.forEach((team) => {
          if (Array.isArray(team.teamLead)) {
            team.teamLead.forEach((tl) => {
              if (tl && tl.toString().trim() !== "") {
                uniqueTLs.add(tl.toString());
              }
            });
          }
        });

        uniqueTLs.forEach((tlId) => {
          notifications.push({
            user: tlId,
            type: "Resignation",
            message: `${emp.name}(${emp.employeeId}) has applied for resignation.`,
            isRead: false,
            createdAt: new Date(),
            triggeredBy: emp._id,
            triggeredByRole: finalRole,
          });
        });
      }

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }

    } catch (notificationError) {
      console.error("Notification creation error:", notificationError);
    }


    res.json({
      message: "Resignation applied successfully",
      resignationId: resignation.resignationId,
      status: "Pending",
      comments: resignation.comments || "",
      employeeName: emp.name,
      applyDate: resignation.applyDate,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", err });
  }
});

// all resignations for specific emp
app.get("/resignation/:empId", async (req, res) => {
  try {
    const { empId } = req.params;
    let emp;

    emp = await User.findOne({ employeeId: empId });

    if (!emp && mongoose.Types.ObjectId.isValid(empId)) {
      emp = await User.findById(empId);
    }

    if (!emp) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const resignations = await Resignation.find({
      employee: emp._id,
    })
      .sort({ createdAt: -1 })
      .populate("employee", "employeeId name")
      .populate("approvedBy", "name role");

    res.json(
      resignations.map((r) => ({
        resignationId: r.resignationId,
        applyDate: r.applyDate
          ? r.applyDate.toISOString().split("T")[0]
          : "N/A",
        reason: r.reason,
        comments: r.comments || "",
        status: r.status,
        approverComment: r.approverComment || "",
        approvedBy: r.approvedBy
          ? {
              name: r.approvedBy.name,
              role: r.approvedBy.role,
            }
          : null,
        approvedDate: r.approvedDate
          ? r.approvedDate.toISOString().split("T")[0]
          : null,
        lastWorkingDay: r.lastWorkingDay
          ? r.lastWorkingDay.toISOString().split("T")[0]
          : null,
      })),
    );
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// hr approve/reject resignation
app.put("/resignation/:resignationId", authenticate, async (req, res) => {
  try {
    const { action, lastWorkingDay, approverComment } = req.body;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const resignation = await Resignation.findOne({
      resignationId: req.params.resignationId,
    }).populate("employee", "name employeeId email");

    if (!resignation)
      return res.status(404).json({ message: "Resignation not found" });

    if (resignation.status !== "Pending") {
      return res.status(400).json({ message: "Resignation already processed" });
    }

    const previousStatus = resignation.status;
    if (action === "approve") {
      if (!lastWorkingDay) {
        return res
          .status(400)
          .json({ message: "Last working day required for approval" });
      }

      resignation.status = "Approved";
      resignation.lastWorkingDay = new Date(lastWorkingDay);
      resignation.approverComment = approverComment || "-";
      resignation.approvedBy = req.user._id;
      resignation.approvedDate = new Date();
    } else if (action === "reject") {
      resignation.status = "Rejected";
      resignation.approverComment = approverComment || "-";
      resignation.approvedBy = req.user._id;
      resignation.approvedDate = new Date();
    } else {
      return res.status(400).json({ message: "Invalid action." });
    }

    await resignation.save();

    await resignation.populate("approvedBy", "name role");

    // added by shivani 
    if (resignation.employee && resignation.status !== previousStatus) {
      try {
        const employeeNotification = {
          user: resignation.employee._id, // always send to resignation owner
          type: "Resignation",
          message: `Your resignation has been ${resignation.status} by ${req.user.role}.`,
          isRead: false,
          triggeredBy: req.user._id,
          triggeredByRole: req.user.role.toUpperCase(), // VERY IMPORTANT
        };
    
        await Notification.create(employeeNotification);
      } catch (notificationError) {
        console.error("Notification creation error:", notificationError);
      }
    }

    // 

    res.json({
      message: `Resignation ${action}ed successfully`,
      status: resignation.status,
      lastWorkingDay: resignation.lastWorkingDay,
      approverComment: resignation.approverComment,
      approvedBy: resignation.approvedBy
        ? {
            name: resignation.approvedBy.name,
            role: resignation.approvedBy.role,
          }
        : null,
      approvedDate: resignation.approvedDate,
    });
  } catch (err) {
    console.error("Error in resignation approval:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// get all resignations
app.get("/resignation", async (req, res) => {
  try {
    const resignations = await Resignation.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "employee",
        select: "employeeId name designation department doj reportingManager",
        populate: {
          path: "reportingManager",
          select: "name",
        },
      })
      .populate("approvedBy", "name role");

    res.json(
      resignations.map((r) => ({
        resignationId: r.resignationId,
        employeeId: r.employee?.employeeId,
        employeeName: r.employee?.name,
        designation: r.employee?.designation,
        department: r.employee?.department,
        applyDate: r.applyDate.toISOString().split("T")[0],
        joiningDate: r.employee?.doj
        ? r.employee.doj.toISOString().split("T")[0]
        : null,

        reportingManager: r.employee?.reportingManager
          ? r.employee?.reportingManager.name
          : "Not assigned",
        reason: r.reason,
        comments: r.comments || "",
        status: r.status,
        approverComment: r.approverComment || "",
        approvedBy: r.approvedBy
          ? {
              name: r.approvedBy.name,
              role: r.approvedBy.role,
            }
          : null,
        approvedDate: r.approvedDate
          ? r.approvedDate.toISOString().split("T")[0]
          : null,
        lastWorkingDay: r.lastWorkingDay
          ? r.lastWorkingDay.toISOString().split("T")[0]
          : null,
      })),
    );
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

app.delete("/cancel/resignation/:id", async (req, res) => {
  try {
    const { id } = req.params;

    let resignation = await Resignation.findOne({ resignationId: id });

    if (!resignation) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        resignation = await Resignation.findById(id);
      }
    }

    if (!resignation) {
      return res.status(404).json({
        success: false,
        message: "Resignation not found",
      });
    }

    if (
      resignation.status === "Approved" ||
      resignation.status === "Rejected"
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete. Resignation is already ${resignation.status}`,
      });
    }

    await Resignation.deleteOne({ _id: resignation._id });

    res.json({
      success: true,
      message: "Resignation deleted successfully",
      deletedId: resignation.resignationId || id,
    });
  } catch (err) {
    console.error("Delete resignation error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

//get resignaton specific manager
app.get("/resignation/manager/:managerId", async (req, res) => {
  try {
    const allResignations = await Resignation.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "employee",
        select: "employeeId name designation department doj reportingManager",
        populate: {
          path: "reportingManager",
          select: "name",
        },
      })
      .populate("approvedBy", "name role");

    const managerResignations = allResignations.filter(
      (r) =>
        r.employee &&
        r.employee.reportingManager &&
        r.employee.reportingManager._id.toString() === req.params.managerId &&
        r.employee.role !== "manager",
    );

    const result = managerResignations.map((r) => ({
      resignationId: r.resignationId,
      employeeId: r.employee.employeeId,
      employeeName: r.employee.name,
      designation: r.employee.designation,
      department: r.employee.department,
      applyDate: r.applyDate.toISOString().split("T")[0],
      joiningDate: r.employee.doj
        ? r.employee.doj.toISOString().split("T")[0]
        : null,
      reportingManager: r.employee.reportingManager
        ? r.employee.reportingManager.name
        : "Not assigned",
      reason: r.reason,
      comments: r.comments || "",
      status: r.status,
      approverComment: r.approverComment || "",
      approvedBy: r.approvedBy
        ? {
            name: r.approvedBy.name,
            role: r.approvedBy.role,
          }
        : null,
      approvedDate: r.approvedDate
        ? r.approvedDate.toISOString().split("T")[0]
        : null,
      lastWorkingDay: r.lastWorkingDay
        ? r.lastWorkingDay.toISOString().split("T")[0]
        : null,
    }));

    res.json({
      total: result.length,
      resignations: result,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});



//Jayshree interview start

// employees + managers list to get in Interview scheduling
app.get("/allEmp", async (req, res) => {
  try {
    const users = await User.find(
      { role: { $in: ["employee", "manager", "Team_Leader"] } },
      {
        employeeId: 1,
        name: 1,
        designation: 1,
        role: 1,
      },
    );

    res.json({ success: true, employees: users });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ================= HR CREATE SCHEDULE INTERVIEW (Jayashree 6th jan)=================

// app.post(
//   "/schedule-interview",
//   resumeUpload.single("resume"), // ✅ multer middleware
//   authenticate,
//   async (req, res) => {
//     console.log("FILE 👉", req.file); // 🔥 MUST PRINT
//     if (req.user.role !== "hr") {
//       return res.status(403).json({ message: "Forbidden: hr only" });
//     }
//     try {
//       const interviewData = {
//         candidateName: req.body.candidateName,
//         email: req.body.email,
//         role: req.body.role,
//         date: req.body.date,
//         startTime: req.body.startTime,
//         endTime: req.body.endTime,
//         duration: req.body.duration,
//         interviewType: req.body.interviewType,
//         interviewerId: new mongoose.Types.ObjectId(req.body.interviewerId),
//         interviewerName: req.body.interviewerName,
//         link: req.body.interviewType === "Online" ? req.body.link : "",
//         manualStatus: null,
//         comment: req.body.comment || "",
//         // resumeUrl: req.file ? `/uploads/${req.file.filename}` : null,
//         resumeUrl: req.file ? req.file.path : null,
//       };
//       if (interviewData.interviewType === "Online" && !interviewData.link) {
//         return res.status(400).json({
//           success: false,
//           message: "Interview link is required for online interviews",
//         });
//       }
//       console.log("FILE DATA:", req.file);

//       // 🔐 BACKEND SAFETY VALIDATION
//       const start = new Date(`1970-01-01T${interviewData.startTime}`);
//       const end = new Date(`1970-01-01T${interviewData.endTime}`);

//       if (end <= start) {
//         return res.status(400).json({
//           success: false,
//           message: "End time must be after start time",
//         });
//       }
//       // ✅ ADD THIS LINE (VERY IMPORTANT)
//       // interviewData.interviewer = interviewData.employeeId;
//       const interview = new Interview(interviewData);
//       await interview.save();

//       // 🔔 CREATE NOTIFICATION (MANAGER / EMPLOYEE)
//       await Notification.create({
//         user: interview.interviewerId, // 👈 SAME ID
//         type: "Interview",
//         message: `New interview scheduled for ${interview.candidateName} on ${interview.date}`,
//         interviewRef: interview._id,
//         triggeredByRole: req.user.role.toUpperCase(),
//       });

//       res.status(201).json({
//         success: true,
//         message: "Interview scheduled successfully",
//         interview,
//       });
//     } catch (err) {
//       console.error(err);
//       res.status(500).json({
//         success: false,
//         message: "Failed to schedule interview",
//         error: err.message,
//       });
//     }
//   },
// );
// ================= TIME FORMAT FUNCTION =================

const formatTime12Hour = (time) => {

  if (!time) return "";

  const [hour, minute] = time.split(":");

  const date = new Date();

  date.setHours(hour);
  date.setMinutes(minute);

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

};

// ================= HR CREATE SCHEDULE INTERVIEW =================

app.post(
  "/schedule-interview",
  resumeUpload.single("resume"),
  authenticate,
  async (req, res) => {
    console.log("FILE 👉", req.file);

    if (req.user.role !== "hr") {
      return res.status(403).json({
        message: "Forbidden: hr only",
      });
    }

    try {
      // ================= INTERVIEW DATA =================

      const interviewData = {
        candidateName: req.body.candidateName,
        email: req.body.email,
        role: req.body.role,
        date: req.body.date,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        duration: req.body.duration,
        interviewType: req.body.interviewType,

        interviewerId: new mongoose.Types.ObjectId(
          req.body.interviewerId
        ),

        interviewerName: req.body.interviewerName,

        link:
          req.body.interviewType === "Online"
            ? req.body.link
            : "",

        manualStatus: null,

        comment: req.body.comment || "",

        resumeUrl: req.file ? req.file.path : null,
      };

      // ================= VALIDATION =================

      if (
        interviewData.interviewType === "Online" &&
        !interviewData.link
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Interview link is required for online interviews",
        });
      }

      // ================= TIME VALIDATION =================

      const start = new Date(
        `1970-01-01T${interviewData.startTime}`
      );

      const end = new Date(
        `1970-01-01T${interviewData.endTime}`
      );

      if (end <= start) {
        return res.status(400).json({
          success: false,
          message: "End time must be after start time",
        });
      }

      // ================= SAVE INTERVIEW =================

      const interview = new Interview(interviewData);

      await interview.save();

      // ================= FIND INTERVIEWER =================

      // const interviewer = await User.findById(
      //   interview.interviewerId
      // );
      const interviewer = await User.findById(
  interview.interviewerId
);

console.log("INTERVIEWER DATA 👉", interviewer);

if (!interviewer || !interviewer.email) {
  return res.status(400).json({
    success: false,
    message: "Interviewer email not found",
  });
}

      // ================= CREATE NOTIFICATION =================

      await Notification.create({
        user: interview.interviewerId,

        type: "Interview",

        message: `New interview scheduled for ${interview.candidateName} on ${interview.date}`,

        interviewRef: interview._id,

        triggeredByRole: req.user.role.toUpperCase(),
      });

      // ================= RESUME ATTACHMENT =================

      const attachments = [];

      if (req.file) {
        attachments.push({
          filename: req.file.originalname,
          path: req.file.path,
        });
      }

      // ================= CANDIDATE MAIL =================

      const candidateMailOptions = {
        from: process.env.EMAIL_USER,

        to: interview.email,

        subject: `Interview Scheduled @Creative Web Solution - ${interview.role}`,

        html: `
        <div style="font-family: Arial, sans-serif; padding:20px;">

          

          <p>Dear ${interview.candidateName},</p>

          <p>
            We are pleased to inform you that your profile has been shortlisted and you have been selected for the interview process for the position of ${interview.role}.
          </p>
          <p>
          Your interview details are as follows:
          </p>

          <table cellpadding="8">

            <tr>
              <td><b>Position:</b></td>
              <td>${interview.role}</td>
            </tr>

            <tr>
              <td><b>Date:</b></td>
              <td>${interview.date}</td>
            </tr>

            <tr>
              <td><b>Time:</b></td>
              <td>
         
                ${formatTime12Hour(interview.startTime)} - ${formatTime12Hour(interview.endTime)}
              </td>
            </tr>

            <tr>
              <td><b>Duration:</b></td>
              <td>${interview.duration}</td>
            </tr>

            <tr>
              <td><b>Interview Type:</b></td>
              <td>${interview.interviewType}</td>
            </tr>

            

            ${
              interview.interviewType === "Online"
                ? `
            <tr>
              <td><b>Meeting Link:</b></td>
              <td>
                <a href="${interview.link}">
                  Join Interview
                </a>
              </td>
            </tr>
            `
                : ""
            }

          </table>

          <br/> 
          <p> Your resume has been successfully shared with the interview panel for reference. </p> 
          <p> Kindly ensure your availability at the scheduled time. We request you to join the meeting 5–10 minutes before the interview begins. </p> 
          <p> If you have any queries or require any assistance, please feel free to contact the HR Team. </p>
           <p> We wish you all the best for your interview and look forward to speaking with you. </p> 
           <br/>

          <p>
            Thanks & Regards,<br/>
            HR Executive <br/>
            📞1234567890 <br/>
            📧hr@creativewebsolution.in<br/>
            🌐www.creativewebsolution.in
           
          </p>

        </div>
      `,
      };

      // ================= INTERVIEWER MAIL =================

      const interviewerMailOptions = {
        from: process.env.EMAIL_USER,

        to: interviewer.email,

        subject: `Interview Assigned @Creative Web Solution - ${interview.candidateName}`,

        html: `
        <div style="font-family: Arial, sans-serif; padding:20px;">

        

          <p>Dear ${interview.interviewerName},</p>

          <p>
          This is to inform you that the interview round for a  ${interview.role} position has been scheduled as per the details below: 
          </p>

          <table cellpadding="8">
           

            <tr>
              <td><b>Candidate Name:</b></td>
              <td>${interview.candidateName}</td>
            </tr>

            <tr>
              <td><b>Role:</b></td>
              <td>${interview.role}</td>
            </tr>

            <tr>
              <td><b>Date:</b></td>
              <td>${interview.date}</td>
            </tr>

            <tr>
              <td><b>Time:</b></td>
              <td>
                ${formatTime12Hour(interview.startTime)} - ${formatTime12Hour(interview.endTime)}
              </td>
            </tr>

            <tr>
              <td><b>Duration:</b></td>
              <td>${interview.duration}</td>
            </tr>

            <tr>
              <td><b>Interview Type:</b></td>
              <td>${interview.interviewType}</td>
            </tr>

            ${
              interview.interviewType === "Online"
                ? `
            <tr>
              <td><b>Meeting Link:</b></td>
              <td>
                <a href="${interview.link}">
                  Join Meeting
                </a>
              </td>
            </tr>
            `
                : ""
            }

          </table>

          <br/>

          <p>
            Please find the attached resume of the candidate for your review and reference. </p>
                    <p>
           kindly let us know if you require any additional information from our end.
          </p>
                    <p>
           Thank you for your cooperation.
          </p>

          <br/>

          <p>
            Thanks & Regards,<br/>
            HR Executive <br/>
            📞1234567890 <br/>
            📧hr@creativewebsolution.in<br/>
            🌐www.creativewebsolution.in
           
          </p>


        </div>
      `,

        attachments,
      };

      // ================= HR MAIL =================

      const hrMailOptions = {
        from: process.env.EMAIL_USER,

        to: process.env.HR_EMAIL,

        subject: `Interview Scheduled Successfully`,

        html: `
        <div style="font-family: Arial, sans-serif; padding:20px;">

        
         <p> Dear HR Team,</p>

          <p>This is to confirm that the interview has been successfully scheduled. <p>

          <table cellpadding="8">
          
            <tr>
              <td><b>Candidate Name:</b></td>
              <td>${interview.candidateName}</td>
            </tr>

            <tr>
              <td><b>Role:</b></td>
              <td>${interview.role}</td>
            </tr>

            <tr>
              <td><b>Interviewer Name:</b></td>
              <td>${interview.interviewerName}</td>
            </tr>

            <tr>
              <td><b>Date:</b></td>
              <td>${interview.date}</td>
            </tr>

            <tr>
              <td><b>Time:</b></td>
              <td>
                ${formatTime12Hour(interview.startTime)} - ${formatTime12Hour(interview.endTime)}
              </td>
            </tr>

          </table>

          <br/>
 <p>The candidate resume and interview details have been shared successfully with the respective interviewer and candidate.</p>
         
 
            <p>
            Thanks & Regards,<br/>
            Creative Web Solutions
            🌐www.creativewebsolution.in
            </p>

        </div>
      `,
      };

      // ================= SEND MAILS =================

      await transporter.sendMail(candidateMailOptions);

      await transporter.sendMail(interviewerMailOptions);

      await transporter.sendMail(hrMailOptions);

// ================= INTERVIEW REMINDER MAIL =================

// Interview Date + Time
const interviewDateTime = new Date(
  `${interview.date}T${interview.startTime}`
);

// Reminder Before 5 Minutes
const reminderTime =
  interviewDateTime.getTime() - 5 * 60 * 1000;

// Current Time
const currentTime = Date.now();

// Delay
const delay = reminderTime - currentTime;

// Only Future Interviews
if (delay > 0) {

  console.log(
    `⏰ Reminder scheduled in ${delay / 1000} seconds`
  );

  setTimeout(async () => {

    try {

// CANDIDATE REMINDER MAIL
// =====================================================

const candidateReminderSubject =
  `Reminder: Upcoming Interview @ Creative Web Solutions - ${interview.role}`;

const candidateReminderHTML = `
<div style="font-family: Arial, sans-serif; padding:25px; line-height:1.7; color:#333;">



  <p>
    Hi ${interview.candidateName},
  </p>

  <p>
    This is a friendly reminder regarding your upcoming interview for the position of
    <b>${interview.role}</b> at Creative Web Solutions.
  </p>

  <p>
    Please find the interview details below:
  </p>

  <table cellpadding="8" style="border-collapse: collapse;">

    <tr>
      <td><b>Interview Date</b></td>
      <td>${interview.date}</td>
    </tr>

    <tr>
      <td><b>Interview Time</b></td>
      <td>${formatTime12Hour(interview.startTime)} - ${formatTime12Hour(interview.endTime)}</td>
    </tr>

    
    <tr>
      <td><b>Interview Type</b></td>
      <td>${interview.interviewType}</td>
    </tr>

    ${
      interview.interviewType === "Online"
        ? `
    <tr>
      <td><b>Meeting Link</b></td>
      <td>
        <a
          href="${interview.link}"
          style="color:#0d6efd; text-decoration:none;"
        >
          Join Interview Meeting
        </a>
      </td>
    </tr>
    `
        : ""
    }

  </table>

  <br/>

  <p>
    Kindly ensure your availability and join the interview
    5–10 minutes before the scheduled time.
  </p>

  <p>
    We wish you all the best for your interview and look forward to speaking with you.
  </p>

  <br/>

  <p>
  Thanks & Regards,<br/>
            HR Executive <br/>
            📞1234567890 <br/>
            📧hr@creativewebsolution.in<br/>
            🌐www.creativewebsolution.in
  </p>

</div>
`;


// =====================================================
// INTERVIEWER REMINDER MAIL
// =====================================================

const interviewerReminderSubject =
  `Reminder: Interview Scheduled with ${interview.candidateName}`;

const interviewerReminderHTML = `
<div style="font-family: Arial, sans-serif; padding:25px; line-height:1.7; color:#333;">

  

  <p>
    Hi ${interview.interviewerName},
  </p>

  <p>
    This is a quick reminder regarding your scheduled interview with
    <b>${interview.candidateName}</b> for the position of
    <b>${interview.role}</b>.
  </p>

  <p>
    Please find the interview details below:
  </p>

  <table cellpadding="8" style="border-collapse: collapse;">

    <tr>
      <td><b>Candidate Name</b></td>
      <td>${interview.candidateName}</td>
    </tr>

    <tr>
      <td><b>Interview Date</b></td>
      <td>${interview.date}</td>
    </tr>

    <tr>
      <td><b>Interview Time</b></td>
      <td>${formatTime12Hour(interview.startTime)} - ${formatTime12Hour(interview.endTime)}</td>
    </tr>

    <tr>
      <td><b>Interview Type</b></td>
      <td>${interview.interviewType}</td>
    </tr>

    ${
      interview.interviewType === "Online"
        ? `
    <tr>
      <td><b>Meeting Link</b></td>
      <td>
        <a
          href="${interview.link}"
          style="color:#0d6efd; text-decoration:none;"
        >
          Join Interview Meeting
        </a>
      </td>
    </tr>
    `
        : ""
    }

  </table>

  <br/>

  <p>
    The candidate resume has already been shared with you for reference.
  </p>

  <p>
    Kindly ensure your availability and be prepared for the discussion.
  </p>

  <br/>

  <p>
    Thanks & Regards,<br/>
            HR Executive <br/>
            📞1234567890 <br/>
            📧hr@creativewebsolution.in<br/>
            🌐www.creativewebsolution.in
  </p>

</div>
`;


// =====================================================
// HR REMINDER MAIL
// =====================================================

const hrReminderSubject =
  `Reminder: Upcoming Interview - ${interview.candidateName}`;

const hrReminderHTML = `
<div style="font-family: Arial, sans-serif; padding:25px; line-height:1.7; color:#333;">

  

  <p>
    Dear HR Team,
  </p>

  <p>
    This is a reminder that the following interview is scheduled to begin shortly.
  </p>

  <table cellpadding="8" style="border-collapse: collapse;">

    <tr>
      <td><b>Candidate Name</b></td>
      <td>${interview.candidateName}</td>
    </tr>

    <tr>
      <td><b>Role</b></td>
      <td>${interview.role}</td>
    </tr>

    <tr>
      <td><b>Interviewer</b></td>
      <td>${interview.interviewerName}</td>
    </tr>

    <tr>
      <td><b>Interview Date</b></td>
      <td>${interview.date}</td>
    </tr>

    <tr>
      <td><b>Interview Time</b></td>
      <td>${formatTime12Hour(interview.startTime)} - ${formatTime12Hour(interview.endTime)}</td>
    </tr>

  </table>

  <br/>

  <p>
    Reminder notifications have been successfully scheduled for both the candidate and interviewer.
  </p>

  <br/>

  <p>
Thanks & Regards,<br/>
            HR Executive <br/>
            📞1234567890 <br/>
            📧hr@creativewebsolution.in<br/>
            🌐www.creativewebsolution.in
  </p>

</div>
`;


// =====================================================
// SEND REMINDER MAILS
// =====================================================

// Candidate Reminder
if (interview.email) {

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: interview.email,
    subject: candidateReminderSubject,
    html: candidateReminderHTML,
  });

}

// Interviewer Reminder
if (interviewer?.email) {

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: interviewer.email,
    subject: interviewerReminderSubject,
    html: interviewerReminderHTML,
    attachments,
  });

}

// HR Reminder
if (process.env.HR_EMAIL) {

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.HR_EMAIL,
    subject: hrReminderSubject,
    html: hrReminderHTML,
  });

}

      console.log(
        "✅ Reminder mails sent successfully"
      );

    } catch (error) {

      console.log(
        "❌ Reminder mail error:",
        error.message
      );

    }

  }, delay);

}
      // ================= SUCCESS RESPONSE =================

      res.status(201).json({
        success: true,
        message:
          "Interview scheduled and emails sent successfully",
        interview,
      });

    } catch (err) {

      console.error("INTERVIEW ERROR:", err);

      res.status(500).json({
        success: false,
        message: "Failed to schedule interview",
        error: err.message,
      });
    }
  }
);

// ================= GET ALL INTERVIEWS =================
app.get("/interviews", async (req, res) => {
  try {
    const interviews = await Interview.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      interviews,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch interviews",
    });
  }
});

// get Schedule Interview API for Employee Role
app.get("/interviews/employee/:employeeId", authenticate, async (req, res) => {
  try {
    //jaicy
    console.log(req.user.role);
    if (req.user.role !== "employee" && req.user.role !== "IT_Support" && req.user.role !== "Team_Leader") { //rutuja
      return res.status(403).json({ message: "Forbidden: employees only" });
    }
    const { employeeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({ message: "Invalid employeeId" });
    }

    const interviews = await Interview.find(
      { interviewerId: employeeId }, // 🔥 CORE MATCH
      {
        interviewId: 1,
        candidateName: 1,
        email: 1,
        role: 1,
        resumeUrl: 1,
        date: 1,
        startTime: 1,
        endTime: 1,
        duration: 1,
        interviewType: 1,
        interviewerId: 1,
        interviewerName: 1,
        link: 1,
        status: 1,
        comment: 1,
        manualStatus: 1
      },
    ).sort({ date: 1 });

    res.status(200).json(interviews);
  } catch (error) {
    console.error("Employee interview fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// get Schedule Interview API for Manager Role
app.get("/interviews/manager/:managerId", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "manager") {
      return res.status(403).json({ message: "Forbidden: employees only" });
    }

    // ✅ SAME STYLE AS EMPLOYEE
    const { managerId } = req.params;

    // 🛡️ ObjectId validation
    if (!mongoose.Types.ObjectId.isValid(managerId)) {
      return res.status(400).json({ message: "Invalid managerId" });
    }

    // 🔥 INTERVIEWSID HI USE KARNA HAI
    const interviews = await Interview.find(
      { interviewerId: managerId }, // 🔥 SAME CORE LOGIC
      {
        interviewId: 1,
        candidateName: 1,
        email: 1,
        role: 1,
        resumeUrl: 1,
        date: 1,
        startTime: 1,
        endTime: 1,
        duration: 1,
        interviewType: 1,
        interviewerId: 1,
        interviewerName: 1,
        link: 1,
        status: 1,
        comment: 1,
        manualStatus: 1
      },
    ).sort({ date: 1 });

    res.status(200).json(interviews);
  } catch (error) {
    console.error("Manager interview fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE interview 10th jan
app.delete("/interviewsDelete/:id", async (req, res) => {
  console.log("DELETE HIT", req.params.id);
  try {
    const { id } = req.params;

    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found",
      });
    }

    //❌ ON-GOING interview delete nahi hoga
    if (interview.status === "On-going") {
      return res.status(400).json({
        success: false,
        message: "On-going interview cannot be deleted",
      });
    }

    await Interview.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Interview deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to delete interview",
    });
  }
});


app.put(
  "/interviewsUpdate/:id",
  authenticate,
  resumeUpload.single("resume"),
  async (req, res) => {
    console.log("PUT HIT", req.params.id);
    console.log("BODY:", req.body);
    try {
      const { id } = req.params;

      const interview = await Interview.findById(id);
      const oldInterviewerId = interview.interviewerId?.toString();
      if (!interview) {
        return res.status(404).json({
          success: false,
          message: "Interview not found",
        });
      }

      // ❌ ON-GOING interview update nahi hoga
      // if (interview.status === "On-going") {
      //   return res.status(400).json({
      //     success: false,
      //     message: "On-going interview cannot be updated",
      //   });
      // }
       const manualStatus =
          req.body.manualStatus === "null" ||
          req.body.manualStatus === "" ||
          req.body.manualStatus === undefined
            ? null
            : req.body.manualStatus;
      // Update text fields
      if (req.body.candidateName)
        interview.candidateName = req.body.candidateName;
      if (req.body.email) interview.email = req.body.email;
      if (req.body.role) interview.role = req.body.role;
      if (req.body.date) interview.date = req.body.date;
      if (req.body.startTime) interview.startTime = req.body.startTime;
      if (req.body.endTime) interview.endTime = req.body.endTime;
      if (req.body.duration) interview.duration = req.body.duration;
      if (req.body.interviewType)
        interview.interviewType = req.body.interviewType;
      if (req.body.interviewerId)
        interview.interviewerId = req.body.interviewerId;
      if (req.body.interviewerName)
        interview.interviewerName = req.body.interviewerName;
      if (req.body.link) interview.link = req.body.link;
      //===== HR STATUS UPDATE (NEW)
      if (manualStatus) {
        interview.manualStatus = manualStatus; 
        // Only Cancelled / Not-completed allowed by schema
      }
      if (req.body.comment) interview.comment = req.body.comment;
      // 🔥 Update resume only if a new file is uploaded
      // if (req.file) {
      //   interview.resumeUrl = `/uploads/${req.file.filename}`;
      // }
      if (req.file) {
        interview.resumeUrl = req.file.path;
      }

      if (interview.interviewType === "Online") {
        if (!req.body.link && !interview.link) {
          return res.status(400).json({
            success: false,
            message: "Interview link is required for online interviews",
          });
        }
        if (req.body.link) interview.link = req.body.link;
      } else {
        interview.link = ""; // Offline → clear link
      }

      // ⏱️ TIME VALIDATION
      if (interview.startTime && interview.endTime) {
        const start = new Date(`1970-01-01T${interview.startTime}`);
        const end = new Date(`1970-01-01T${interview.endTime}`);

        if (end <= start) {
          return res.status(400).json({
            success: false,
            message: "End time must be after start time",
          });
        }
      }
      if (req.body.date) {
  const oldDate = new Date(interview.date);
  const newDate = new Date(req.body.date);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 🔥 Condition:
  // newDate >= today
  // AND newDate <= oldDate
  if (
    newDate >= today &&
    newDate <= oldDate &&
    interview.manualStatus === "Not-completed"&&manualStatus!=="Cancelled"&&manualStatus!=="Not-completed"
  ) {
    interview.manualStatus = null;
  }
}

      await interview.save();

      // 🔔 INTERVIEWER CHANGE NOTIFICATION
      if (
        req.body.interviewerId &&
        req.body.interviewerId !== oldInterviewerId
      ) {
        await Notification.create({
          user: req.body.interviewerId, // new interviewer
          type: "Interview",
          message: `You have been assigned a new interview for ${interview.candidateName} on ${new Date(interview.date).toLocaleDateString()}`,
          interviewRef: interview._id,
          triggeredByRole: req.user.role.toUpperCase(),
        });
      }

      res.json({
        success: true,
        message: "Interview updated successfully",
        data: interview,
      });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ success: false, message: "Failed to update interview" });
    }
  },
);

// UPDATE interview status & comment (EMPLOYEE)
// app.put("/interviews/employee/:interviewId", authenticate, async (req, res) => {
//   try {
//     // 🔐 ROLE CHECK
//     if (req.user.role !== "employee") {
//       return res.status(403).json({ message: "Access denied" });
//     }

//     const { interviewId } = req.params;
//     const { status, comment } = req.body;

//     // ✅ ID VALIDATION
//     if (!mongoose.Types.ObjectId.isValid(interviewId)) {
//       return res.status(400).json({ message: "Invalid interviewId" });
//     }

//     // 🔍 FIND INTERVIEW FIRST
//     const interview = await Interview.findById(interviewId);

//     if (!interview) {
//       return res.status(404).json({ message: "Interview not found" });
//     }

//     if (interview.status === "On-going") {
//       return res.status(400).json({
//         message: "On-going interview cannot be updated",
//       });
//     }
//     // ✅ ONLY ALLOWED FIELDS
//     const updateData = {};
//     if (status) updateData.status = status;
//     if (comment !== undefined) updateData.comment = comment;

//     // 🔥 UPDATE
//     const updatedInterview = await Interview.findByIdAndUpdate(
//       interviewId,
//       updateData,
//       { new: true },
//     );

//     res.status(200).json({
//       message: "Interview updated successfully",
//       data: updatedInterview,
//     });
//   } catch (error) {
//     console.error("Employee interview update error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// });
app.put("/interviews/employee/:interviewId", authenticate, async (req, res) => {
  try {
    // 🔐 ROLE CHECK
    if (req.user.role !== "employee") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { interviewId } = req.params;
    const { manualStatus, comment } = req.body;

    // ✅ ID VALIDATION
    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      return res.status(400).json({ message: "Invalid interviewId" });
    }

    // 🔍 FIND INTERVIEW
    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    // ❌ BLOCK ON-GOING UPDATE (Virtual Status Check)
    if (interview.status === "On-going") {
      return res.status(400).json({
        message: "On-going interview cannot be updated",
      });
    }
    const newManualStatus =
      manualStatus === "" ||
      manualStatus === undefined ||
      manualStatus === null
       ? null
       : manualStatus;


    // ✅ Manual Status Update (Only allowed enum values from schema)
      interview.manualStatus = newManualStatus;
    

    // ✅ Comment Update
    if (comment !== undefined) {
      interview.comment = comment;
    }

    await interview.save();

    res.status(200).json({
      message: "Interview updated successfully",
      data: interview,
    });

  } catch (error) {
    console.error("Employee interview update error:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// UPDATE interview status & comment (MANAGER)
app.put("/interviews/managerUpdate/:interviewId",
  authenticate,
  async (req, res) => {
    try {
      // 🔐 ROLE CHECK
      if (req.user.role !== "manager") {
        return res.status(403).json({ message: "Access denied" });
      }

      const { interviewId } = req.params;
      const { manualStatus, comment } = req.body;

      // ✅ ID VALIDATION
      if (!mongoose.Types.ObjectId.isValid(interviewId)) {
        return res.status(400).json({ message: "Invalid interviewId" });
      }

      // 🔍 FIND INTERVIEW
      const interview = await Interview.findById(interviewId);

      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      // ❌ BLOCK ON-GOING UPDATE (Virtual Status Check)
      if (interview.status === "On-going") {
        return res.status(400).json({
          message: "On-going interview cannot be updated",
        });
      }

      // ✅ Manual Status Update
      const newManualStatus =
      manualStatus === "" ||
      manualStatus === undefined ||
      manualStatus === null
       ? null
       : manualStatus;


    // ✅ Manual Status Update (Only allowed enum values from schema)
      interview.manualStatus = newManualStatus;

      // ✅ Comment Update
      if (comment !== undefined) {
        interview.comment = comment;
      }

      await interview.save();

      res.status(200).json({
        message: "Interview updated successfully",
        data: interview,
      });

    } catch (error) {
      console.error("Manager interview update error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);



// jayshree interview end


//Performance API Added by Jayshree
// Crete Performnace at HR (jayu 19th jan)
// Crete Performnace at HR (jayu 19th jan)
app.post("/performance", async (req, res) => {
  try {
    const {
      employeeId,
      employeeName,
      department,
      manager,
      managerId,
      durationType,
      durationDate,
      description,
    } = req.body;

    // Required field validation
    if (
      !employeeId ||
      !employeeName ||
      !department ||
      !manager ||
      !durationType ||
      !durationDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      });
    }

    // 🔍 FIND USER USING employeeId (IMPORTANT PART)
    const user = await User.findOne({ employeeId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // optional: ensure employee role
    if (user.role !== "employee") {
      return res.status(400).json({
        success: false,
        message: "Selected user is not an employee",
      });
    }

    // Validate managerId if provided
    let validManagerId = null;
    if (managerId) {
      if (!mongoose.Types.ObjectId.isValid(managerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid managerId",
        });
      }
      validManagerId = managerId;
    }

    // Date parsing
    let parsedDate;
    if (durationType === "Monthly") {
      parsedDate = new Date(`${durationDate}-01`);
    } else {
      parsedDate = new Date(durationDate);
    }

    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid durationDate",
      });
    }

    //  CREATE PERFORMANCE (userId backend se set)
    const performance = new Performance({
      userId: user._id, // 👈 UI se nahi aaya
      employeeId: employeeId.toString(),
      employeeName,
      department,
      manager,
      managerId: validManagerId,
      durationType,
      durationDate: parsedDate,
      description,
    });

    await performance.save();
    // added by shivani

   const teams = await Team.find({
      assignToProject: { $in: [user._id] }
    }).populate("teamLead", "_id name role");

    const teamLeaders = new Set();
    teams.forEach(team => {
      if (team.teamLead && team.teamLead.length) {
        team.teamLead.forEach(tl => {
          if (tl && tl.role === "Team_Leader") {
            teamLeaders.add(tl._id.toString());
          }
        });
      }
    });

    for (const tlId of teamLeaders) {
      await Notification.create({
        user: tlId,
        type: "Performance",
        message: `New performance request created for ${employeeName}`,
        triggeredByRole: "HR",
        announcementRef: performance._id,
        isRead: false,
        createdAt: new Date(),
      });
    }

    if (managerId && mongoose.Types.ObjectId.isValid(managerId)) {
      await Notification.create({
        user: managerId,
        type: "Performance",
        message: `New performance request created for ${employeeName} (${employeeId})`,
        triggeredByRole: "HR",
        announcementRef: performance._id,
        isRead: false,
        createdAt: new Date(),
      });
    }

    const adminRoles = ["md", "admin", "ceo", "coo"];
    const adminUsers = await User.find({ 
      role: { $in: adminRoles },
      isDeleted: false
    }).select("_id");

    for (const admin of adminUsers) {
      await Notification.create({
        user: admin._id,
        type: "Performance",
        message: `New performance request created for ${employeeName} (${employeeId}) by HR`,
        triggeredByRole: "HR",
        announcementRef: performance._id,
        isRead: false,
        createdAt: new Date(),
      });
    }
//  Save notifications
// await Notification.insertMany(notifications);

    res.status(201).json({
      success: true,
      message: "Performance request created successfully",
      data: performance,
    });
  } catch (error) {
    console.error("Performance create error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Get all performance requests for HR
app.get("/performance/getrequests", async (req, res) => {
  try {
    const list = await Performance.find()
      .populate("approvedBy", "name email")
      .populate("rejectedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: list,
    });
  } catch (error) {
    console.error("Fetch performance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch performance requests",
    });
  }
});

app.get("/performance/team-leader/:teamLeadId", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "Team_Leader") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Team Leaders can view this data."
      });
    }

    const { teamLeadId } = req.params;

    if (teamLeadId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own team's performance data."
      });
    }

    if (!mongoose.Types.ObjectId.isValid(teamLeadId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid teamLeaderId" 
      });
    }

    const teams = await Team.find({ 
      teamLead: { $in: [teamLeadId] }
    }).populate("assignToProject", "_id");

    const employeeIds = [];
    teams.forEach(team => {
      if (team.assignToProject && Array.isArray(team.assignToProject)) {
        team.assignToProject.forEach(employee => {
          if (employee && employee._id) {
            employeeIds.push(employee._id.toString());
          }
        });
      }
    });

    if (employeeIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No team members found"
      });
    }

    const performances = await Performance.find({
      userId: { $in: employeeIds }
    })
      .populate("approvedBy", "name email employeeId")
      .populate("rejectedBy", "name email employeeId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: performances
    });
  } catch (error) {
    console.error("Team Leader performance fetch error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
});
// Delete Performance Request (HR)(Jayu 20 Jan)
app.delete("/performance/:id", async (req, res) => {
  try {
    const { id } = req.params;

    //  check record exists
    const performance = await Performance.findById(id);

    if (!performance) {
      return res.status(404).json({
        success: false,
        message: "Performance request not found",
      });
    }

    await Notification.deleteMany({ announcementRef: id });
    //  delete
    await Performance.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Performance request deleted successfully",
    });
  } catch (error) {
    console.error("Delete performance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete performance request",
    });
  }
});

// getPerformance API for Manager Role
app.get("/performance/manager/:managerId", async (req, res) => {
  try {
    const { managerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(managerId)) {
      return res.status(400).json({ message: "Invalid managerId" });
    }

    const performances = await Performance.find(
      { managerId }, // fetch only records for this manager
      {
        // _id: 1,
        employeeId: 1,
        requestId: 1,
        employeeName: 1,
        manager: 1,
        department: 1,
        durationType: 1,
        durationDate: 1,
        rating: 1,
        status: 1,
        recommendation: 1,
        adminStatus: 1,
        approvedBy: 1,
        rejectedBy: 1,
        approvedAt: 1,
        rejectedAt: 1,
        description: 1,
      },
    )
      .populate("approvedBy", "name email employeeId")
      .populate("rejectedBy", "name email employeeId")
      .sort({ createdAt: -1 });

    res.status(200).json(performances);
  } catch (error) {
    console.error("Manager performance fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/performance/team-leader/:performanceId", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "Team_Leader") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only Team Leaders can update performance."
      });
    }

    const { performanceId } = req.params;
    const { rating, status, recommendation } = req.body;

    if (!mongoose.Types.ObjectId.isValid(performanceId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid performanceId" 
      });
    }

    if (!status || !recommendation) {
      return res.status(400).json({
        success: false,
        message: "Status and Recommendation are required",
      });
    }

    if (!["Pending", "Added"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'Pending' or 'Added'",
      });
    }

    if (!["Pending", "Promotion", "Increment", "Training"].includes(recommendation)) {
      return res.status(400).json({
        success: false,
        message: "Invalid recommendation value",
      });
    }

    const performance = await Performance.findById(performanceId);
    if (!performance) {
      return res.status(404).json({
        success: false,
        message: "Performance record not found",
      });
    }

    if (performance.adminStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot update. Performance is already ${performance.adminStatus}.`,
      });
    }

    const teams = await Team.find({ 
      teamLead: { $in: [req.user._id] },
      assignToProject: { $in: [performance.userId] }
    });

    if (teams.length === 0) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update performance for this employee"
      });
    }

    const updatedPerformance = await Performance.findByIdAndUpdate(
      performanceId,
      {
        rating: rating || null,
        status,
        recommendation,
        updatedByTL: req.user._id,
        updatedByTLAt: new Date()
      },
      {
        new: true,
        runValidators: true,
      }
    );

    const hrUsers = await User.find({ role: "hr" }).select("_id");
    const teamLeader = await User.findById(req.user._id).select("name");
    
    //hr notif
    const notifications = hrUsers.map((user) => ({
      user: user._id,
      type: "Performance",
      message: `${teamLeader.name} (Team Leader) updated the performance of ${updatedPerformance.employeeName}`,
      triggeredByRole: "Team_Leader",
      announcementRef: updatedPerformance._id,
      isRead: false,
      createdAt: new Date(),
    }));

    // mamanger notification
    if (performance.managerId) {
      notifications.push({
        user: performance.managerId,
        type: "Performance",
        message: `${teamLeader.name} (Team Leader) updated the performance of ${updatedPerformance.employeeName}`,
        triggeredByRole: "Team_Leader",
        announcementRef: updatedPerformance._id,
        isRead: false,
        createdAt: new Date(),
      });
    }

    // admins notif
    const adminUsers = await User.find({ 
      role: { $in: ["admin", "ceo", "coo", "md"] },
      isDeleted: false
    }).select("_id");
    
    for (const admin of adminUsers) {
      notifications.push({
        user: admin._id,
        type: "Performance",
        message: `${teamLeader.name} (Team Leader) updated the performance of ${updatedPerformance.employeeName}`,
        triggeredByRole: "Team_Leader",
        announcementRef: updatedPerformance._id,
        isRead: false,
        createdAt: new Date(),
      });
    }

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }



    res.status(200).json({
      success: true,
      message: "Performance updated successfully by tl",
      data: updatedPerformance,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
});

// getPerformance API for Employee Role
app.get("/performance/employee", async (req, res) => {
  try {
    const { userId, role } = req.query;

    console.log("ROLE:", role);
    console.log("USER ID:", userId);

    // VALIDATION
    if (!userId || !role) {
      return res.status(400).json({
        success: false,
        message: "userId or role missing",
      });
    }

    // ROLE CHECK
    if (role.toUpperCase() !== "EMPLOYEE") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // ObjectId validation (important 🔒)
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId",
      });
    }

    // FETCH ONLY LOGGED-IN EMPLOYEE DATA
    const performances = await Performance.find({
      userId: userId, // 👈 schema based
    })
      .populate("approvedBy", "name email employeeId")
      .populate("rejectedBy", "name email employeeId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: performances,
    });
  } catch (error) {
    console.error("Employee performance fetch error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// GET ALL PERFORMANCE ( CEO, ADMIN, COO)
app.get("/performance/all", async (req, res) => {
  try {
    const { role } = req.query;
    if (!role) {
      return res.status(400).json({ message: "Role missing" });
    }

    const normalizedRole = role.toUpperCase();

    //  ROLE CHECK
    const allowedRoles = ["CEO", "ADMIN", "COO"];

    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const performances = await Performance.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: performances,
    });
  } catch (error) {
    console.error("Fetch all performance error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// jayshree interview end

//Added by Rutuja Performance API

app.get("/performance/admin/pending", authenticate, async (req, res) => {
  try {
    const userRole = req.user.role;

    const allowedRoles = ["admin", "hr", "ceo", "coo", "md"];
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const managerCompletedRequests = await Performance.find({
      status: "Added",
    })
      .populate("approvedBy", "name email employeeId")
      .populate("rejectedBy", "name email employeeId")
      .sort({ createdAt: -1 });

    const approvedCount = managerCompletedRequests.filter(
      (r) => r.adminStatus === "approved",
    ).length;
    const rejectedCount = managerCompletedRequests.filter(
      (r) => r.adminStatus === "rejected",
    ).length;
    const pendingCount = managerCompletedRequests.filter(
      (r) => r.adminStatus === "pending" || !r.adminStatus,
    ).length;

    res.json({
      success: true,
      data: managerCompletedRequests,
      count: managerCompletedRequests.length,
      breakdown: {
        approved: approvedCount,
        rejected: rejectedCount,
        pending: pendingCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// Approve performance request
app.post("/performance/:id/approve", authenticate, async (req, res) => {
  try {
    const performanceId = req.params.id;
    const userId = req.user._id;
    const userRole = req.user.role;
    const userName = req.user.name;

    const allowedRoles = ["admin", "hr", "ceo", "coo", "md"];
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const performance = await Performance.findById(performanceId);
    if (!performance) {
      return res.status(404).json({
        success: false,
        message: "Performance not found",
      });
    }

    if (performance.adminStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Already ${performance.adminStatus}`,
      });
    }

    performance.adminStatus = "approved";
    performance.approvedBy = userId;
    performance.approvedAt = new Date();
    await performance.save();

   const usersToNotify = [];
    
    // manager
    if (performance.managerId) usersToNotify.push(performance.managerId);
    
    // tl
    const employee = await User.findOne({ employeeId: performance.employeeId });
    if (employee) {
      const teams = await Team.find({
        assignToProject: employee._id
      }).populate("teamLead", "_id name role");
      
      for (const team of teams) {
        if (team.teamLead) {
          const teamLeads = Array.isArray(team.teamLead) ? team.teamLead : [team.teamLead];
          for (const tl of teamLeads) {
            if (tl && tl.role === "Team_Leader" && tl._id) {
              usersToNotify.push(tl._id.toString());
            }
          }
        }
      }
    }
    
    // admin ceo coo md
    const allUsers = await User.find({ 
      role: { $in: ["hr", "admin", "ceo", "coo", "md"] },
      _id: { $ne: userId },
      isDeleted: false
    }).select("_id");
    
    for (const user of allUsers) usersToNotify.push(user._id);
    
    const uniqueUsers = [...new Set(usersToNotify)];
    
    const notifications = uniqueUsers.map(id => ({
      user: id,
      type: "Performance",
      message: `${userRole.toUpperCase()} approved the performance of ${performance.employeeName}`,
      triggeredByRole: userRole.toUpperCase(),
      announcementRef: performance._id,
      isRead: false,
      createdAt: new Date(),
    }));
    
    await Notification.insertMany(notifications);

    res.json({
      success: true,
      message: "Performance approved",
      data: performance,
      approvedBy: userName,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// Reject performance request
app.post("/performance/:id/reject", authenticate, async (req, res) => {
  try {
    const performanceId = req.params.id;
    const userId = req.user._id;
    const userRole = req.user.role;
    const userName = req.user.name;

    const allowedRoles = ["admin", "hr", "ceo", "coo", "md"];
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const performance = await Performance.findById(performanceId);
    if (!performance) {
      return res.status(404).json({
        success: false,
        message: "Performance not found",
      });
    }

    if (performance.adminStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Already ${performance.adminStatus}`,
      });
    }

    performance.adminStatus = "rejected";
    performance.rejectedBy = userId;
    performance.rejectedAt = new Date();
    await performance.save();

    // added by shivani
    // Get assigned manager
     const usersToNotify = [];
    // manager
    if (performance.managerId) usersToNotify.push(performance.managerId);
    
    // tl
      const employee = await User.findOne({ employeeId: performance.employeeId });
      if (employee) {
        const teams = await Team.find({
          assignToProject: employee._id
        }).populate("teamLead", "_id name role");
        
        for (const team of teams) {
          if (team.teamLead) {
            const teamLeads = Array.isArray(team.teamLead) ? team.teamLead : [team.teamLead];
            for (const tl of teamLeads) {
              if (tl && tl.role === "Team_Leader" && tl._id) {
                usersToNotify.push(tl._id.toString());
              }
            }
          }
        }
      }
    // admin ceo coo md
    const allUsers = await User.find({ 
      role: { $in: ["hr", "admin", "ceo", "coo", "md"] },
      _id: { $ne: userId },
      isDeleted: false
    }).select("_id");
    
    for (const user of allUsers) usersToNotify.push(user._id);
    
    const uniqueUsers = [...new Set(usersToNotify)];
    
    const notifications = uniqueUsers.map(id => ({
      user: id,
      type: "Performance",
      message: `${userRole.toUpperCase()} rejected the performance of ${performance.employeeName}`,
      triggeredByRole: userRole.toUpperCase(),
      announcementRef: performance._id,
      isRead: false,
      createdAt: new Date(),
    }));
    
    await Notification.insertMany(notifications);
    res.json({
      success: true,
      message: "Performance rejected",
      data: performance,
      rejectedBy: userName,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});



       //Added by harshada 24 Feb 2026

app.get("/policy/acknowledgements/:policyId", async (req, res) => {
  try {
    const { policyId } = req.params;

    const data = await PolicyAcknowledgement.find({ policyId });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

    


app.post("/policy/acknowledge", async (req, res) => {
  try {
    const { policyId, employeeId, employeeName } = req.body;

    if (!policyId || !employeeId || !employeeName) {
      return res.status(400).json({
        success: false,
        message: "Missing data",
      });
    }

    const already = await PolicyAcknowledgement.findOne({
      policyId,
      employeeId,
    });

    if (already) {
      return res.json({
        success: true,
        message: "Already acknowledged",
      });
    }

    await PolicyAcknowledgement.create({
      policyId,
      employeeId,
      employeeName,   // ✅ VERY IMPORTANT
    });

    res.json({
      success: true,
      message: "Policy acknowledged successfully",
    });

  } catch (error) {
    console.log("ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.get("/policy/read-employees/:policyId", async (req, res) => {
  try {
    const { policyId } = req.params;

    // const readEmployees = await PolicyAcknowledgement
    //   .find({ policyId })
    //   .populate("employeeId", "name _id");
    //26-02-2026
    const readEmployees = await PolicyAcknowledgement.find({ policyId });

    res.json({
      success: true,
      data: readEmployees,
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

app.get("/policy/employee-ack/:employeeId", async (req, res) => {
  try {
    const data = await PolicyAcknowledgement.find({
      employeeId: req.params.employeeId,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
    });
  }
});

// module.exports = { app, autoSendBirthdayEmail, autoSendAnniversaryEmail ,autoGrantLeaveIfProbationCompleted};
// require("./cron/Birthdaycron");
// require("./cron/Anniversarycron");
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

/// add cron

// require("./cron/leaveCron");
