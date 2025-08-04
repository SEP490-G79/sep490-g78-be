const db = require("../models");
const dayjs = require("dayjs");

const saveDonation = async (donationData) => {
  try {
    const donation = await db.Donation.create({
      donor: donationData.donor || null,
      amount: donationData.amount,
      message: donationData.message,
    });
    if (!donation) {
      throw new Error("Failed to save donation");
    }
    const resultDonation = await db.Donation.findById(donation._id)
      .populate("donor", "fullName avatar");
    return resultDonation;
  } catch (error) {
    throw error;
  }
};

const getDonationsHistory = async (userId) => {
  try {
    const donations = await db.Donation.find({ donor: userId })
      .populate("donor", "fullName avatar")
      .sort({ createdAt: -1 });
    return donations;
  } catch (error) {
    throw error;
  }
};

const getAllDonations = async () => {
  try {
    const donations = await db.Donation.find()
      .populate("donor", "fullName avatar")
      .sort({ createdAt: -1 });
    return donations;
  } catch (error) {
    throw error;
  }
};

const getMonthlyDonationStats = async () => {
  const currentYear = new Date().getFullYear();

  const months = Array.from({ length: 12 }, (_, index) => `Tháng ${index + 1}`);

  const donations = await db.Donation.find({
    createdAt: {
      $gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
      $lte: new Date(`${currentYear}-12-31T23:59:59.999Z`)
    }
  });

  const chartData = Array.from({ length: 12 }, (_, index) => ({
    month: months[index],
    amount: 0,
  }));

  for (const donation of donations) {
    const monthIndex = dayjs(donation.createdAt).month(); // 0-11
    chartData[monthIndex].amount += donation.amount;
  }

  return chartData;
};

const donationService = {
  saveDonation,
  getDonationsHistory,
  getAllDonations,
  getMonthlyDonationStats,
};

module.exports = donationService;
