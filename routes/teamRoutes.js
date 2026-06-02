const express = require("express");
const router = express.Router();

const {
  createTeam,
  getAllTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
  getTeamsByEmployeeId,
  getTeamsCreatedByUserId,
  getTeamsForUser //added by shivani
} = require("../controller/teamController");

router.get("/createdBy/:userId", getTeamsCreatedByUserId);
router.post("/", createTeam);
router.get("/", getAllTeams);
router.get("/:id", getTeamById);
router.put("/:id", updateTeam);
router.delete("/:id", deleteTeam);
router.get("/employee/:employeeId/teams", getTeamsByEmployeeId);
router.get("/user/:userId/teams", getTeamsForUser);//added by shivani


module.exports = router;
