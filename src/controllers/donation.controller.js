const donationService = require('../services/donation.service');
const payosService = require("../services/payos.service");

const createPaymentLink = async (req, res) => {
  try {
    const url = await payosService.createPaymentLink(req);
    res.status(200).json({ url });
  } catch (error) {
    console.error("Create payment link error:", error.message);
    res.status(400).json({ message: "Failed to create payment link" });
  }
};

const handleWebhook = async (req, res) => {
  try {
    await payosService.handleWebhook(req);
    res.status(200).json({ message: "Webhook received" });
  } catch (error) {
    console.error("Webhook error:", error.message);
    res.sendStatus(400);
  }
};

const saveDonation = async (req, res) => {
  try {
    const donationData = req.body;
    const savedDonation = await donationService.saveDonation(donationData);
    res.status(201).json(savedDonation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

const getDonationsHistory = async (req, res) => {
  try {
    const userId = req.payload.id;
    const donations = await donationService.getDonationsHistory(userId);
    res.status(200).json(donations);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

const getAllDonations = async (req, res) => {
  try {
    const donations = await donationService.getAllDonations();
    res.status(200).json(donations);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

//ADMIN
const getMonthlyDonationStats = async (req, res) => {
  try {
    const donations = await donationService.getMonthlyDonationStats();
    res.status(200).json(donations);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

const donationController = {
    saveDonation,
    getDonationsHistory,
    getAllDonations,
    createPaymentLink,
    handleWebhook,

    //ADMIN
    getMonthlyDonationStats,
}
module.exports = donationController;