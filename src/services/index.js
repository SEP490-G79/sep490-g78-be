const shelterService = require("./shelter.service");
const userService = require('./user.service');
const petService = require("./pet.service");
const adoptionSubmissionService = require("./adoptionSubmission.service");
const medicalRecordService = require("./medicalRecord.service");
const speciesService = require("./species.service");
const questionService = require("./question.service");
const postService = require("./post.service");
const donationService = require("./donation.service");
const blogService = require("./blog.service");
const reportService = require("./report.service");
const authService = require("./auth.service")
const adoptionTemplateService = require("./adoptionTemplate.service");
const adoptionFormService = require("./adoptionForm.service")
const notificationService = require("./notification.service");
const returnRequestService = require("./returnRequest.service");
const breedsService = require("./breed.service");
const consentFormService = require("./consentForm.service");

module.exports = {
    authService,
    userService,
    petService,
    adoptionSubmissionService,
    medicalRecordService,
    shelterService,
    adoptionTemplateService,
    adoptionFormService,
    speciesService,
    breedsService,
    questionService,
    postService,
    donationService,
    blogService,
    reportService,
    notificationService,
    returnRequestService,
    consentFormService,
}
