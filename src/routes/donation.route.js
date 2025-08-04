const express = require ("express");
const donationRouter = express.Router();
const bodyParser = require("body-parser");
const {verifyAccessToken} = require("../middlewares/auth.middleware");
const {isAdmin} = require("../middlewares/admin.middleware")

const { donationController } = require("../controllers");
donationRouter.use(bodyParser.json());

donationRouter.post("/save-donation", donationController.saveDonation);
donationRouter.get("/get-donations-history", verifyAccessToken, donationController.getDonationsHistory);
donationRouter.get("/get-all-donations", verifyAccessToken, donationController.getAllDonations);

//ADMIN
donationRouter.get("/admin/get-all-donations", [verifyAccessToken, isAdmin], donationController.getAllDonations);
donationRouter.get("/admin/get-monthly-donations", [verifyAccessToken, isAdmin], donationController.getMonthlyDonationStats);

module.exports = donationRouter;