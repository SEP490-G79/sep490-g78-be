const shelterService = require("../services/shelter.service");

// USER
const getShelterById = async (req, res) => {
  const shelterId = req.params.shelterId;
  try {
    const shelter = await shelterService.getShelterById(shelterId);
    res.status(200).json(shelter);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const getShelterRequestByUserId = async (req, res, next) => {
  try {
    const { id } = req.payload;
    const response = await shelterService.getShelterRequestByUserId(id);
    res.status(200).json(response);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const sendShelterEstablishmentRequest = async (req, res, next) => {
  try {
    const { id } = req.payload;
    const requestData = {
      ...req.body,
      location: JSON.parse(req?.body.location),
    };
    const response = await shelterService.sendShelterEstablishmentRequest(
      id,
      requestData,
      req.files
    );
    res.status(200).json(response);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const cancelShelterEstabilshmentRequest = async (req, res, next) => {
  try {
    const response = await shelterService.cancelShelterEstabilshmentRequest(
      req.params.requestId
    );
    res.status(200).json(response);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const getShelterProfile = async (req, res, next) => {
  try {
    const { shelterId } = req.params;
    const response = await shelterService.getShelterProfile(shelterId);
    res.status(200).json(response);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const editShelterProfile = async (req, res, next) => {
  try {
    const { shelterId } = req.params;
    const updatedData = {
      ...req.body,
      location: JSON.parse(req?.body.location),
      avatar: req.files?.avatar?.[0],
      background: req.files?.background?.[0],
    };
    const response = await shelterService.editShelterProfile(
      shelterId,
      updatedData
    );
    res.status(200).json(response);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

async function getAll(req, res, next) {
  try {
    const shelters = await shelterService.getAll();
    res.status(200).json(shelters);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function getShelterMembers(req, res, next) {
  try {
    const shelterMembers = await shelterService.getShelterMembers(
      req.params.shelterId
    );
    res.status(200).json(shelterMembers);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function findEligibleUsersToInvite(req, res, next) {
  try {
    const { shelterId } = req.params;
    const response = await shelterService.findEligibleUsersToInvite(shelterId);
    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function inviteShelterMembers(req, res, next) {
  try {
    const { emailsList, roles } = req.body;
    const response = await shelterService.inviteShelterMembers(
      req.params.shelterId,
      emailsList,
      roles
    );
    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function getShelterInvitationsAndRequests(req, res, next) {
  try {
    const { shelterId } = req.params;
    const response = await shelterService.getShelterInvitationsAndRequests(
      shelterId
    );
    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function getUserInvitationsAndRequests(req, res, next) {
  try {
    const response = await shelterService.getUserInvitationsAndRequests(
      req.payload.id
    );
    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function reviewShelterInvitationRequest(req, res, next) {
  try {
    const { shelterId, decision } = req.body;
    const response = await shelterService.reviewShelterInvitationRequest(
      shelterId,
      req.payload.id,
      decision
    );
    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function kickShelterMember(req, res, next) {
  try {
    const { shelterId, userId } = req.body;
    const response = await shelterService.kickShelterMember(shelterId, userId);
    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function requestIntoShelter(req, res, next) {
  try {
    const response = await shelterService.requestIntoShelter(
      req.params.shelterEmail,
      req.payload.id
    );
    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
async function getEligibleShelters(req, res, next) {
  try {
    const response = await shelterService.getEligibleShelters(req.payload.id);
    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
async function reviewShelterRequest(req, res, next) {
  try {
    const { shelterId } = req.params;
    const { requestId, decision } = req.body;
    const response = await shelterService.reviewShelterRequest(
      shelterId,
      requestId,
      decision
    );
    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// Dashboard statistics
const getShelterDashboardStatistics = async (req, res) => {
  try {
    const { shelterId } = req.params;
    const caringPets = await shelterService.getShelterCaringPetsCount(
      shelterId
    );
    const adoptedPets = await shelterService.getShelterAdoptedPetsCount(
      shelterId
    );
    const posts = await shelterService.getShelterPostsCount(shelterId);
    const members = await shelterService.getShelterMembersCount(shelterId);
    const petGrowth = await shelterService.getShelterPetGrowthByMonth(
      shelterId
    );

    res.status(200).json({
      caringPets,
      adoptedPets,
      posts,
      members,
      petGrowth,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const changeShelterMemberRole = async (req, res) => {
  const { shelterId } = req.params;
  const { userId, roles } = req.body;
  try {
    const updatedData = await shelterService.changeShelterMemberRole(
      req.payload.id,
      shelterId,
      userId,
      roles
    );
    res.status(200).json(updatedData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ADMIN
const getAllShelter = async (req, res, next) => {
  try {
    const shelters = await shelterService.getAllShelter();
    res.status(200).json(shelters);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const getAllShelterEstablishmentRequests = async (req, res, next) => {
  try {
    const shelters = await shelterService.getAllShelterEstablishmentRequests();
    res.status(200).json(shelters);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const getOverviewStatistic = async (req, res, next) => {
  try {
    const overviewStatistics = await shelterService.getOverviewStatistic(req.params.year);
    res.status(200).json(overviewStatistics);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const reviewShelterEstablishmentRequest = async (req, res, next) => {
  try {
    const { requestId, decision, rejectReason } = req.body;
    const response = await shelterService.reviewShelterEstablishmentRequest({
      requestId,
      decision,
      rejectReason,
    });
    res.status(200).json(response);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const getAdoptedPetsByWeek = async (req, res) => {
  try {
    const { shelterId } = req.params;
    const data = await shelterService.getAdoptedPetsByWeek(shelterId);
    res.json(data);
  } catch (error) {
    console.error("Error getAdoptedPetsByWeek:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getAdoptionFormsByWeek = async (req, res) => {
  try {
    const shelterId = req.params.shelterId;
    const result = await shelterService.getAdoptionFormsByWeek(shelterId);
    res.json(result);
  } catch (error) {
    console.error("getAdoptionFormsByWeek error:", error);
    res.status(500).json({ message: error.message });
  }
};

const getSubmissionStatistics = async (req, res) => {
  try {
    const { shelterId } = req.params;
    const result = await shelterService.getSubmissionStatistics(shelterId);
    res.json(result);
  } catch (error) {
    console.error("getSubmissionStatistics error:", error);
    res.status(500).json({ message: "Lỗi khi lấy thống kê đơn nhận nuôi" });
  }
};
const getAdoptionSubmissionsByWeek = async (req, res) => {
  try {
    const shelterId = req.params.shelterId;
    const result = await shelterService.getAdoptionSubmissionsByWeek(shelterId);
    res.json(result);
  } catch (error) {
    console.error("getAdoptionSubmissionsByWeek error:", error);
    res.status(500).json({ message: error.message });
  }
};

// EXPORT
const shelterController = {
  //USER
  sendShelterEstablishmentRequest,
  getShelterRequestByUserId,
  getShelterProfile,
  editShelterProfile,
  getAll,
  getShelterById,
  getShelterMembers,
  findEligibleUsersToInvite,
  inviteShelterMembers,
  getShelterInvitationsAndRequests,
  getUserInvitationsAndRequests,
  cancelShelterEstabilshmentRequest,
  reviewShelterInvitationRequest,
  kickShelterMember,
  requestIntoShelter,
  getEligibleShelters,
  reviewShelterRequest,
  getShelterDashboardStatistics,
  changeShelterMemberRole,

  //MANAGER
  getAdoptedPetsByWeek,
  getAdoptionFormsByWeek,
  getSubmissionStatistics,
  getAdoptionSubmissionsByWeek,
  //ADMIN
  getAllShelter,
  getAllShelterEstablishmentRequests,
  getOverviewStatistic,
  reviewShelterEstablishmentRequest,
};

module.exports = shelterController;
