const express = require("express");
const shelterRouter = express.Router({ mergeParams: true });
const bodyParser = require("body-parser");
const shelterController = require("../controllers/shelter.controller");
const postRouter = require("./post.route");
const returnRequestRouter = require("./returnRequest.route");
const {
  verifyAccessToken,
  optionalVerifyAccessToken,
} = require("../middlewares/auth.middleware");
const { isAdmin } = require("../middlewares/admin.middleware");

const {
  isShelterManager,
  isShelterMember,
  isShelterStaff,
} = require("../middlewares/shelter.middleware");
const { consentFormController } = require("../controllers");
const authMiddleware = require("../middlewares/auth.middleware");
const shelterMiddleware = require("../middlewares/shelter.middleware");
const cloudinary = require("../configs/cloudinary");

shelterRouter.use(bodyParser.json());

// USER
shelterRouter.post(
  "/send-shelter-request",
  verifyAccessToken,
  cloudinary.upload.fields([{ name: "shelterLicense", maxCount: 1 }]),
  shelterController.sendShelterEstablishmentRequest
);
shelterRouter.put(
  "/cancel-shelter-request/:requestId",
  verifyAccessToken,
  shelterController.cancelShelterEstabilshmentRequest
);
shelterRouter.get(
  "/get-shelter-request",
  verifyAccessToken,
  shelterController.getShelterRequestByUserId
);
shelterRouter.get(
  "/get-profile/:shelterId",
  [verifyAccessToken, isShelterMember],
  shelterController.getShelterProfile
);
shelterRouter.put(
  "/edit-profile/:shelterId",
  [verifyAccessToken, isShelterManager],
  cloudinary.upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "background", maxCount: 1 },
  ]),
  shelterController.editShelterProfile
);
shelterRouter.get(
  "/dashboard-statistics/:shelterId",
  [verifyAccessToken, isShelterManager],
  shelterController.getShelterDashboardStatistics
);
shelterRouter.get(
  "/:shelterId/statistics/adopted-by-week",
  [verifyAccessToken, isShelterManager],

  shelterController.getAdoptedPetsByWeek
);
shelterRouter.get(
  "/:shelterId/statistics/adoption-forms-by-week",
  [verifyAccessToken, isShelterManager],

  shelterController.getAdoptionFormsByWeek
);

shelterRouter.get(
  "/:shelterId/statistics/submission",
  [verifyAccessToken, isShelterManager],
  shelterController.getSubmissionStatistics
);

shelterRouter.get(
  "/:shelterId/statistics/adoption-submissions-by-week",
  shelterController.getAdoptionSubmissionsByWeek
);

shelterRouter.get("/get-all", shelterController.getAll);
shelterRouter.get(
  "/get-members/:shelterId",
  [verifyAccessToken, isShelterMember],
  shelterController.getShelterMembers
);
shelterRouter.get(
  "/find-eligible-users/:shelterId",
  [verifyAccessToken, isShelterManager],
  shelterController.findEligibleUsersToInvite
);
shelterRouter.post(
  "/invite-members/:shelterId",
  [verifyAccessToken, isShelterManager],
  shelterController.inviteShelterMembers
);
shelterRouter.get(
  "/get-shelter-invitations-and-requests/:shelterId",
  [verifyAccessToken, isShelterManager],
  shelterController.getShelterInvitationsAndRequests
);
shelterRouter.get(
  "/get-user-invitations-and-requests",
  verifyAccessToken,
  shelterController.getUserInvitationsAndRequests
);
shelterRouter.put(
  "/review-shelter-invitation",
  verifyAccessToken,
  shelterController.reviewShelterInvitationRequest
);
shelterRouter.put(
  "/:shelterId/kick-member",
  [verifyAccessToken, isShelterManager],
  shelterController.kickShelterMember
);
shelterRouter.put(
  "/send-staff-request/:shelterEmail",
  verifyAccessToken,
  shelterController.requestIntoShelter
);
shelterRouter.get(
  "/eligible-shelters",
  verifyAccessToken,
  shelterController.getEligibleShelters
);
shelterRouter.put(
  "/:shelterId/review-user-request",
  [verifyAccessToken, isShelterManager],
  shelterController.reviewShelterRequest
);
shelterRouter.put(
  "/:shelterId/change-member-roles",
  [verifyAccessToken, isShelterManager],
  shelterController.changeShelterMemberRole
);
shelterRouter.get("/get-all", shelterController.getAll);

shelterRouter.get("/get-by-id/:shelterId", shelterController.getShelterById);
shelterRouter.get(
  "/get-members/:shelterId",
  [verifyAccessToken, isShelterMember],
  shelterController.getShelterMembers
);
shelterRouter.get(
  "/find-eligible-users/:shelterId",
  [verifyAccessToken, isShelterManager],
  shelterController.findEligibleUsersToInvite
);
shelterRouter.post(
  "/invite-members/:shelterId",
  [verifyAccessToken, isShelterManager],
  shelterController.inviteShelterMembers
);
shelterRouter.get(
  "/get-shelter-invitations-and-requests/:shelterId",
  [verifyAccessToken, isShelterManager],
  shelterController.getShelterInvitationsAndRequests
);
shelterRouter.get(
  "/get-user-invitations-and-requests",
  verifyAccessToken,
  shelterController.getUserInvitationsAndRequests
);
shelterRouter.put(
  "/review-shelter-invitation",
  verifyAccessToken,
  shelterController.reviewShelterInvitationRequest
);

shelterRouter.get(
  "/:shelterId/consentForms/get-by-shelter",
  [
    authMiddleware.verifyAccessToken,
    authMiddleware.isActive,
    shelterMiddleware.isShelterMember,
  ],
  consentFormController.getByShelter
);

shelterRouter.put(
  "/:shelterId/kick-member",
  [verifyAccessToken, isShelterManager],
  shelterController.kickShelterMember
);
shelterRouter.put(
  "/send-staff-request/:shelterEmail",
  verifyAccessToken,
  shelterController.requestIntoShelter
);
shelterRouter.get(
  "/eligible-shelters",
  verifyAccessToken,
  shelterController.getEligibleShelters
);
shelterRouter.put(
  "/:shelterId/review-user-request",
  [verifyAccessToken, isShelterManager],
  shelterController.reviewShelterRequest
);
shelterRouter.put(
  "/:shelterId/change-member-roles",
  [verifyAccessToken, isShelterManager],
  shelterController.changeShelterMemberRole
);
shelterRouter.use("/:shelterId/posts", postRouter);
shelterRouter.use("/:shelterId/return-requests", returnRequestRouter);

// ADMIN
shelterRouter.get(
  "/admin/get-shelters-list",
  [verifyAccessToken, isAdmin],
  shelterController.getAllShelter
);
shelterRouter.get(
  "/admin/get-shelter-requests-list",
  [verifyAccessToken, isAdmin],
  shelterController.getAllShelterEstablishmentRequests
);
shelterRouter.get(
  "/admin/get-overview-statistics/:year",
  [verifyAccessToken, isAdmin],
  shelterController.getOverviewStatistic
);
shelterRouter.post(
  "/admin/review-shelter-request",
  [verifyAccessToken, isAdmin],
  shelterController.reviewShelterEstablishmentRequest
);

shelterRouter.post(
  "/:shelterId/consentForms/create-form",
  [
    authMiddleware.verifyAccessToken,
    authMiddleware.isActive,
    shelterMiddleware.isShelterMember,
    cloudinary.upload.array("attachments", 2),
    (err, req, res, next) => {
      if (err?.code == "LIMIT_UNEXPECTED_FILE") {
        return res
          .status(400)
          .json({ message: "Tối đa 2 ảnh được phép đăng." });
      }
      next();
    },
  ],
  consentFormController.createForm
);

shelterRouter.put(
  "/:shelterId/consentForms/:consentFormId/edit",
  [
    authMiddleware.verifyAccessToken,
    authMiddleware.isActive,
    shelterMiddleware.isShelterMember,
    cloudinary.upload.array("attachments", 2),
    (err, req, res, next) => {
      if (err?.code == "LIMIT_UNEXPECTED_FILE") {
        return res
          .status(400)
          .json({ message: "Tối đa 2 ảnh được phép đăng." });
      }
      next();
    },
  ],
  consentFormController.editForm
);
shelterRouter.put(
  "/:shelterId/consentForms/:consentFormId/change-status-shelter",
  [
    authMiddleware.verifyAccessToken,
    authMiddleware.isActive,
    shelterMiddleware.isShelterMember,
  ],
  consentFormController.changeFormStatusShelter
);

shelterRouter.delete(
  "/:shelterId/consentForms/:consentFormId/delete",
  [
    authMiddleware.verifyAccessToken,
    authMiddleware.isActive,
    shelterMiddleware.isShelterMember,
  ],
  consentFormController.deleteForm
);

module.exports = shelterRouter;
