const donationService = require('../services/donation.service');

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

    //ADMIN
    getMonthlyDonationStats,
}
module.exports = donationController;