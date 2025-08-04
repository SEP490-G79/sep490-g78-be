const userRouter = require("./user.route");
const authRouter = require("./auth.route");
const petRouter = require("./pet.route");
const adoptionSubmissionRouter = require("./adoptionSubmission.route");
const medicalRecordRouter = require("./medicalRecord.route");
const shelterRouter = require("./shelter.route");
const adoptionTemplateRouter = require("./adoptionTemplate.route");
const adoptionFormRouter = require("./adoptionForm.route");
const speciesRouter = require("./species.route");
const breedRouter = require("./breed.route");
const blogRouter = require("./blog.route");
const reportRouter = require("./report.route");
const postRouter = require("./post.route");
const donationRouter = require("./donation.route");
const notificationRouter = require("./notification.route");
const returnRequestRouter = require("./returnRequest.route");
const consentFormRouter = require("./consentForm.route");


module.exports = {
  petRouter,
  userRouter,
  authRouter,
  adoptionSubmissionRouter,
  medicalRecordRouter,
  shelterRouter,
  adoptionTemplateRouter,
  postRouter,
  speciesRouter,
  breedRouter,
  adoptionFormRouter,
  donationRouter,
  blogRouter,
  reportRouter,
  notificationRouter,
  returnRequestRouter,
  consentFormRouter,
};

