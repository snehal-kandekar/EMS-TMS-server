const Team = require("../models/TeamSchema");
const TaskNotification = require("../models/TaskNotificationSchema");
const Project = require("../models/ProjectSchema");

exports.createTeam = async (req, res) => {
  try {
    const project = await Project.findById(req.body.project).select("managers");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (!project.managers || project.managers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Project has no manager assigned",
      });
    }

    const team = new Team({
      name: req.body.name,
      project: project._id,
      department: req.body.department,
      teamLead: req.body.teamLead, //shivani
      assignToProject: req.body.assignToProject || [],
      createdBy: req.body.createdBy,
    });

    await team.save();

    const savedTeam = await Team.findById(team._id)
      .populate("project", "_id name startDate endDate dueDate")
      .populate("assignToProject", "_id name")
      .populate("teamLead", "_id name") // shivani
      .populate("createdBy", "_id name");

    // -------------------------------------------------------
    const teamName = savedTeam.name;
    const projectName = savedTeam.project?.name;
    const teamMembers = savedTeam.assignToProject || [];
    const projectId = savedTeam.project?._id;

    const teamLeads = savedTeam.teamLead || [];
    //shivani
    const teamLeadMessage = `You have been assigned as Team Lead for team "${teamName}" in project "${projectName}".`;

    for (const lead of teamLeads) {
      await TaskNotification.create({
        user: lead._id,
        type: "Team",
        message: teamLeadMessage,
        taskRef: null,
        projectRef: projectId,
        isRead: false,
      });
    }

    console.log(`Notification sent to ${teamLeads.length} team leads.`);
        
    //shivani
    // --------------------------------------------------------

    res.status(201).json({
      success: true,
      data: savedTeam,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAllTeams = async (req, res) => {
  try {
    const teams = await Team.find({
      project: { $exists: true, $ne: null },
    })
      .populate({
        path: "project",
        match: { _id: { $exists: true } },
      })
      .populate("assignToProject", "_id name")
      .populate("teamLead", "_id name") // shivani

    const filteredTeams = teams.filter((team) => team.project !== null);

    res.status(200).json({
      success: true,
      data: filteredTeams,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate({
        path: "project",
        match: { _id: { $exists: true } },
      })
      .populate("teamLead", "_id name") // shivani
      .populate("assignToProject", "_id name");

    if (!team || !team.project) {
      return res.status(404).json({
        success: false,
        message: "Team not found or project not assigned",
      });
    }
    res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//update by shivani
exports.updateTeam = async (req, res) => {
  try {
    const updatedTeam = await Team.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("project", "_id name")
      .populate("teamLead", "_id name")
      .populate("assignToProject", "_id name");

    if (!updatedTeam) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    const teamName = updatedTeam.name;
    const projectName = updatedTeam.project?.name;
    const projectId = updatedTeam.project?._id;

    const members = updatedTeam.assignToProject || [];
    const teamLead = updatedTeam.teamLead || [];

    const message = `Team "${teamName}" has been updated in project "${projectName}".`;

    // notify team lead
    for (const lead of teamLead) {
      await TaskNotification.create({
        user: lead._id,
        type: "Team",
        message,
        projectRef: projectId,
        isRead: false,
      });
    }

    // notify team members
    for (const member of members) {
      await TaskNotification.create({
        user: member._id,
        type: "Team",
        message,
        projectRef: projectId,
        isRead: false,
      });
    }

    res.status(200).json({
      success: true,
      data: updatedTeam,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//update by shivani
exports.deleteTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate("project", "_id name")
      .populate("teamLead", "_id name")
      .populate("assignToProject", "_id name");

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    const teamName = team.name;
    const projectName = team.project?.name;
    const projectId = team.project?._id;

    const members = team.assignToProject || [];
    const teamLead = team.teamLead || [];

    const message = `Team "${teamName}" has been deleted from project "${projectName}".`;

    // notify team lead
    for (const lead of teamLead) {
      await TaskNotification.create({
        user: lead._id,
        type: "Team",
        message,
        projectRef: projectId,
        isRead: false,
      });
    }

    // notify members
    for (const member of members) {
      await TaskNotification.create({
        user: member._id,
        type: "Team",
        message,
        projectRef: projectId,
        isRead: false,
      });
    }

    await Team.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Team deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// exports.getTeamsByEmployeeId = async (req, res) => {
//   try {
//     const teams = await Team.find({
//       assignToProject: req.params.employeeId
//     })

//     .populate({
//         path: "project",
//         populate: {
//           path: "managers",
//           select: "name"
//         }
//       })
//      .populate("assignToProject", "_id name")

//     res.status(200).json({
//       success: true,
//       data: teams
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message
//     });
//   }
// };

exports.getTeamsByEmployeeId = async (req, res) => {
  try {
    const teams = await Team.find({
      assignToProject: req.params.employeeId,
      project: { $exists: true, $ne: null },
    })
      .populate({
        path: "project",

        populate: {
          path: "managers",
          select: "name",
        },
      })
      .populate("teamLead", "_id name") // shivani
      .populate("assignToProject", "_id name");

    // ✅ remove orphaned projects (populate -> null)
    const filteredTeams = teams.filter((team) => team.project !== null);

    res.status(200).json({
      success: true,
      data: filteredTeams,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const mongoose = require("mongoose");

exports.getTeamsCreatedByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid User ID",
      });
    }

    const teams = await Team.find({
      createdBy: userId,
      project: { $exists: true, $ne: null },
    })
      .populate("project")
      .populate("assignToProject", "_id name")
      .populate("teamLead", "_id name") // shivani
      .sort({ createdAt: -1 });

    const filteredTeams = teams.filter((team) => team.project !== null);

    res.status(200).json({
      success: true,
      count: filteredTeams.length,
      data: filteredTeams,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


//added by shivani
exports.getTeamsForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const teams = await Team.find({
      $or: [
        { assignToProject: userId },
        { teamLead: userId }
      ]
    })
      .populate("project")
      .populate("teamLead", "_id name")
      .populate({
  path: "project",
  populate: {
    path: "managers",
    select: "name"
  }
})
      .populate("assignToProject", "_id name");

    res.status(200).json({
      success: true,
      data: teams
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

