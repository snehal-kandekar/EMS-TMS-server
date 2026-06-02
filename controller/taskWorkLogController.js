const TaskWorkLog = require("../models/TaskWorkLog");
const Task = require("../models/TaskSchema");
const Employee = require("../models/User");
const workloadService = require("../services/workloadService");
const { getEmployeeWorkloadByRange } = require("../services/workloadService");
const { getEmployeeWorkloadByWeekRange } = require("../services/workloadService");
const mongoose = require("mongoose");
const TaskNotification = require("../models/TaskNotificationSchema");

// Create Work Log rutuja 01-04-26
exports.createWorkLog = async (req, res) => {
  try {
    const allowedRoles = ["employee"];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Access denied" });
    }
    
    const {
      tasks, // 01-04-26
      employee,
      challengesFaced,
      whatLearnedToday,
    } = req.body;

    // Validate required fields
    if (!tasks || !tasks.length || !employee || !challengesFaced || !whatLearnedToday) {
      return res.status(400).json({ 
        message: "All fields are required. At least one task must be added." 
      });
    }

    // Validate each task
    for (const taskItem of tasks) {
      if (!taskItem.task || !taskItem.startTime || !taskItem.endTime) {
        return res.status(400).json({ 
          message: "Each task must have task ID, start time, and end time." 
        });
      }

      const taskExists = await Task.findById(taskItem.task);
      if (!taskExists) {
        return res.status(404).json({ 
          message: `Task not found: ${taskItem.task}` 
        });
      }

      // Validate status
      if (taskItem.status === "In Progress") {
        if (taskItem.progressToday === undefined || taskItem.progressToday === null) {
          return res.status(400).json({
            message: "progressToday is required when status is In Progress.",
          });
        }

        if (taskItem.progressToday < 0 || taskItem.progressToday > 100) {
          return res.status(400).json({
            message: "progressToday must be between 0 and 100.",
          });
        }
      }
    }

    const employeeExists = await Employee.findById(employee);
    if (!employeeExists) {
      return res.status(404).json({ message: "Employee not found." });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if work log already exists for today
    const alreadyLogged = await TaskWorkLog.findOne({
      employee,
      date: today,
    });
    
    if (alreadyLogged) {
      return res.status(400).json({ 
        message: "Work log already submitted for today." 
      });
    }

    const processedTasks = [];
    for (const taskItem of tasks) {
      // Convert time to minutes for comparison
      const convertToMinutes = (time) => {
        const [h, m] = time.split(":").map(Number);
        return h * 60 + m;
      };

      if (convertToMinutes(taskItem.startTime) >= convertToMinutes(taskItem.endTime)) {
        return res.status(400).json({ 
          message: `Start time must be earlier than end time for task: ${taskItem.task}` 
        });
      }

      const totalHours = (convertToMinutes(taskItem.endTime) - convertToMinutes(taskItem.startTime)) / 60;

      processedTasks.push({
        task: taskItem.task,
        startTime: taskItem.startTime,
        endTime: taskItem.endTime,
        totalHours,
        status: taskItem.status || "Pending",
        ...(taskItem.status === "In Progress" && { progressToday: taskItem.progressToday }),
      });
    }

    const log = await TaskWorkLog.create({
      tasks: processedTasks,
      employee,
      date: today,
      challengesFaced,
      whatLearnedToday,
    });

    // Create notification 01-02-26
    const employeeData = await Employee.findById(employee).select('name');
    const employeeName = employeeData ? employeeData.name : 'Employee';

    const uniqueCreators = new Set();
    for (const taskItem of processedTasks) {
      const taskWithCreator = await Task.findById(taskItem.task).populate('createdBy');
      if (taskWithCreator && taskWithCreator.createdBy) {
        uniqueCreators.add(taskWithCreator.createdBy._id.toString());
      }
    }

    for (const creatorId of uniqueCreators) {
      await TaskNotification.create({
        user: creatorId,
        type: "TaskLog",
        message: `${employeeName} has submitted a Task Log`,
        isRead: false,
        taskLogRef: log._id,
      });
    }

    res.status(201).json({ 
      message: "Task log submitted successfully.", 
      log 
    });
  } catch (err) {
    res.status(500).json({ 
      message: "Failed to create log", 
      error: err.message 
    });
  }
};


// Get logs by employee 01-04-26
exports.getEmployeeLogs = async (req, res) => {
  try {
    const logs = await TaskWorkLog.find({ employee: req.params.id })
      .populate({
        path: "tasks.task", // 01-04-26
        model: "Task",
      })
      .populate({
        path: "approvedBy",
        select: "name email",
      })
      .populate({
        path: "employee",
        select: "name",
      })
      .sort({ createdAt: -1 });

    const filteredLogs = logs.filter(log => 
      log.tasks && log.tasks.length > 0 && 
      log.tasks.every(taskItem => taskItem.task !== null)
    );

    res.json(filteredLogs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch logs" });
  }
};



// Get all logs (Admin / HR / Manager)
exports.getAllLogs = async (req, res) => {
  try {
    const logs = await TaskWorkLog.find()
      .populate({
        path: "tasks.task",
        model: "Task", //01-04-26
      })
      .populate({
        path: "employee",
      })
      .populate({
        path: "approvedBy",
        select: "name email",
      })
      .sort({ createdAt: -1 });

      const filteredLogs = logs.filter(log => 
      log.tasks && log.tasks.length > 0 && 
      log.tasks.every(taskItem => taskItem.task !== null)
    ); //rutuja 01-04-26

    res.json(filteredLogs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch logs" });
  }
};

// rutuja 01-04-26 Update Work Log (Employee before approval)
exports.updateWorkLog = async (req, res) => {
  try {
    const allowedRoles = ["employee"];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Access denied" });
    }
    const { id } = req.params;

    const {
      tasks,
      employee,
      challengesFaced,
      whatLearnedToday,
    } = req.body;

    if (!tasks || !tasks.length || !employee || !challengesFaced || !whatLearnedToday) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const log = await TaskWorkLog.findById(id);
    if (!log) return res.status(404).json({ message: "Work log not found." });

    // Check if any task is approved
    const hasApprovedTask = log.tasks.some(task => task.status === "Approved");
    if (hasApprovedTask) {
      return res.status(403).json({ message: "Approved logs cannot be edited." });
    }

    const employeeExists = await Employee.findById(employee);
    if (!employeeExists)
      return res.status(404).json({ message: "Employee not found." });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (new Date(log.date).getTime() !== today.getTime()) {
      return res.status(403).json({ message: "Only today's work logs can be updated." });
    }

    // Process each task
    const processedTasks = [];
    for (const taskItem of tasks) {
      const taskExists = await Task.findById(taskItem.task);
      if (!taskExists)
        return res.status(404).json({ message: `Task not found: ${taskItem.task}` });

      const convertToMinutes = (time) => {
        const [h, m] = time.split(":").map(Number);
        return h * 60 + m;
      };

      if (convertToMinutes(taskItem.startTime) >= convertToMinutes(taskItem.endTime)) {
        return res.status(400).json({ message: "Start time must be less than end time." });
      }

      const totalHours = (convertToMinutes(taskItem.endTime) - convertToMinutes(taskItem.startTime)) / 60;

      if (taskItem.status === "In Progress") {
        if (taskItem.progressToday === undefined || taskItem.progressToday === null) {
          return res.status(400).json({
            message: "progressToday is required when status is In progress.",
          });
        }
        if (taskItem.progressToday < 0 || taskItem.progressToday > 100) {
          return res.status(400).json({
            message: "progressToday must be between 0 and 100.",
          });
        }
      }

      processedTasks.push({
        task: taskItem.task,
        startTime: taskItem.startTime,
        endTime: taskItem.endTime,
        totalHours,
        status: taskItem.status,
        ...(taskItem.status === "In Progress" && { progressToday: taskItem.progressToday }),
      });
    }

    log.tasks = processedTasks;
    log.employee = employee;
    log.challengesFaced = challengesFaced;
    log.whatLearnedToday = whatLearnedToday;

    await log.save();

    res.status(200).json({ message: "Work log updated successfully.", log });
  } catch (err) {
    res.status(500).json({ message: "Failed to update work log.", error: err.message });
  }
};



//get tasklog by idd
exports.getTaskLogById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid TaskLog ID" });
    }

    const log = await TaskWorkLog.findById(id)
    .populate({
      path: "tasks.task",
      model: "Task",
    })//rutuja 01-04-26
      .populate("employee", "-password -refreshToken")
      .populate("approvedBy", "name email");

    if (!log) {
      return res.status(404).json({ message: "Task log not found" });
    }

    res.status(200).json(log);
  } catch (err) {
    console.error("Get TaskLog by ID error:", err);
    res
      .status(500)
      .json({ message: "Failed to fetch task log", error: err.message });
  }
};

// Approve / Reject Log (01-04-26)
exports.approveRejectLog = async (req, res) => {
  try {
    const allowedRoles = ["Team_Leader"];
    console.log(req.user);
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Access denied" });
    }
    const { status, remarks, rating } = req.body;

    const existingLog = await TaskWorkLog.findById(req.params.id)
      .populate({
        path: "tasks.task",
        model: "Task",
      })
      .populate('employee', 'name');
      
    if (!existingLog) {
      return res.status(404).json({ message: "Work log not found" });
    }

    // Update all tasks with the same status
    const updatedTasks = existingLog.tasks.map(task => ({
      ...task.toObject(),
      status: status,
    }));

    const log = await TaskWorkLog.findByIdAndUpdate(
      req.params.id,
      {
        tasks: updatedTasks,
        remarks,
        rating,
        approvedBy: req.user.id,
        approvedAt: new Date(),
      },
      { new: true },
    ).populate({
      path: "tasks.task",
      model: "Task",
    });

    const tlName = req.user.name || 'Team Leader';
    
    // Create notification
    for (const taskItem of existingLog.tasks) {
      const taskName = taskItem.task ? taskItem.task.taskName : 'the task';
      
      let message = '';
      if (status === 'Approved') {
        message = `${tlName} has approved your Task log for ${taskName}`;
        if (remarks) {
          message += `. Remarks: ${remarks}`;
        }
      } else if (status === 'Rejected') {
        message = `${tlName} has rejected your Task log for ${taskName}`;
        if (remarks) {
          message += `. Remarks: ${remarks}`;
        } else {
          message += `. Please update and resubmit.`;
        }
      }
      
      await TaskNotification.create({
        user: existingLog.employee._id,
        type: "TaskLog",
        message: message,
        taskRef: taskItem.task._id,
        projectRef: taskItem.task.project,
        isRead: false,
        taskLogRef: existingLog._id,
      });
    }

    res.json(log);
  } catch (err) {
    res.status(500).json({ message: "Approval failed", error: err.message });
  }
};



//rutuja new api to get TL Tasklog  (01-04-26)
exports.getLogsByTeamLeader = async (req, res) => {
  try {
    const teamLeaderId = req.params.teamLeaderId;

    const tasks = await Task.find({ createdBy: teamLeaderId }).select('_id');
    const taskIds = tasks.map(task => task._id);
    
    const logs = await TaskWorkLog.find({ 
      "tasks.task": { $in: taskIds } 
    })
    .populate('employee', 'name email')
    .populate({
      path: "tasks.task",
      model: "Task",
      select: 'taskName dateOfTaskAssignment dateOfExpectedCompletion'
    })
    .populate('approvedBy', 'name email')
    .sort({ createdAt: -1 });

    res.status(200).json(logs);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ 
      message: "Failed to fetch logs", 
      error: err.message 
    });
  }
};


//rutuja api to get manager tasklog requests (01-04-26)
exports.getLogsByReportingManager = async (req, res) => {
  try {
    const managerId = req.params.managerId;
    
    const employees = await Employee.find({ 
      reportingManager: managerId 
    }).select('_id');
    
    const employeeIds = employees.map(emp => emp._id);
    
    if (employeeIds.length === 0) {
      return res.json([]);
    }

    const logs = await TaskWorkLog.find({ 
      employee: { $in: employeeIds } 
    })
    .populate({
      path: "tasks.task",
      model: "Task",
    })
    .populate({
      path: "employee",
    })
    .populate({
      path: "approvedBy",
      select: "name email",
    })
    .sort({ createdAt: -1 });
    
    const filteredLogs = logs.filter(log => 
      log.tasks && log.tasks.length > 0 && 
      log.tasks.every(taskItem => taskItem.task !== null)
    );

    res.json(filteredLogs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch reporting manager logs" });
  }
};


// Delete Log (Employee only when pending) (01-04-26)
exports.deleteWorkLog = async (req, res) => {
  try {
    const log = await TaskWorkLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: "Log not found" });
    
    // Check if any task is approved
    const hasApprovedTask = log.tasks.some(task => task.status === "Approved");
    if (hasApprovedTask) {
      return res.status(400).json({ message: "Cannot delete approved log" });
    }

    await TaskNotification.deleteMany({ 
      $or: [
        { taskLogRef: log._id },
        { 
          type: "TaskLog",
          user: log.employee,
          createdAt: { $gte: new Date(log.date) }
        }
      ]
    });

    await log.deleteOne();
    res.json({ message: "Log deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
};

//get workload
exports.getDailyWorkload = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    const data = await workloadService.getDailyEmployeeWorkload(date);

    res.status(200).json({
      date,
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// get weekly workload

function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) - 6 (Sat)
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);

  const start = new Date(d.setDate(diffToMonday));
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

exports.getWeeklyWorkload = async (req, res) => {
  const { date } = req.query;

  const { start, end } = getWeekRange(date);

  // const data = await getEmployeeWorkloadByWeekRange(start, end, 9 * 5); // 5 working days
  const data = await getEmployeeWorkloadByWeekRange(start, end);

  res.json({
    week: `${start.toISOString()} - ${end.toISOString()}`,
    data,
  });
};

//get monthly workload

function getMonthRange(year, month) {
  const start = new Date(year, month - 1, 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(year, month, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

exports.getMonthlyWorkload = async (req, res) => {
  const { year, month } = req.query;

  const { start, end } = getMonthRange(year, month);

  //  const workingDays = 22; // average
  const data = await getEmployeeWorkloadByRange(start, end);

  res.json({
    month,
    year,
    data,
  });
};
