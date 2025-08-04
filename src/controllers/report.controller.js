const reportService = require("../services/report.service");
const fs = require("fs")

//USER
const reportUserById = async (req, res) => {
  try {
    const {id} = req.payload;
    const response = await reportService.reportUser(id, req.body, req.files)
    res.status(200).json(response);
  } catch (error) {
    const filesToDelete = req.files?.photos || [];
    for (const file of filesToDelete) {
      fs.unlink(file.path, (err) => {
        if (err) {
          console.error("Error deleting file:", file.path, err);
        }
      });
    }
    res.status(400).json({ message: error.message });
  }
};
const reportPostById = async (req, res) => {
  try {
    const {id} = req.payload;
    const response = await reportService.reportPost(id, req.body, req.files)
    res.status(200).json(response);
  } catch (error) {
    const filesToDelete = req.files?.photos || [];
    for (const file of filesToDelete) {
      fs.unlink(file.path, (err) => {
        if (err) {
          console.error("Error deleting file:", file.path, err);
        }
      });
    }
    res.status(400).json({ message: error.message });
  }
};
const reportBlogById = async (req, res) => {
  try {
    const {id} = req.payload;
    const response = await reportService.reportBlog(id, req.body, req.files)
    res.status(200).json(response);
  } catch (error) {
    const filesToDelete = req.files?.photos || [];
    for (const file of filesToDelete) {
      fs.unlink(file.path, (err) => {
        if (err) {
          console.error("Error deleting file:", file.path, err);
        }
      });
    }
    res.status(400).json({ message: error.message });
  }
};


//ADMIN
const getUserReports = async (req, res) => {
  try {
    const reports = await reportService.getUserReports();
    res.status(200).json(reports);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const getPendingUserReports = async (req, res) => {
  try {
    const reports = await reportService.getPendingUserReports();
    res.status(200).json(reports);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const reviewUserReport = async (req, res) => {
  try {
    const reports = await reportService.reviewUserReport(req.payload.id, req.params.reportId, req.params.decision);
    res.status(200).json(reports);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const getPostReports = async (req, res) => {
  try {
    const reports = await reportService.getPostReports();
    res.status(200).json(reports);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const getPendingPostReports = async (req, res) => {
  try {
    const reports = await reportService.getPendingPostReports();
    res.status(200).json(reports);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const reviewPostReport = async (req, res) => {
  try {
    const reports = await reportService.reviewPostReport(req.payload.id, req.params.reportId, req.params.decision);
    res.status(200).json(reports);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const getBlogReports = async (req, res) => {
  try {
    const reports = await reportService.getBlogReports();
    res.status(200).json(reports);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const getPendingBlogReports = async (req, res) => {
  try {
    const reports = await reportService.getPendingBlogReports();
    res.status(200).json(reports);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const reviewBlogReport = async (req, res) => {
  try {
    const reports = await reportService.reviewBlogReport(req.payload.id, req.params.reportId, req.params.decision);
    res.status(200).json(reports);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const reportController = {
  //USER
  reportUserById,
  reportPostById,
  reportBlogById,

  //ADMIN
  getUserReports,
  getPendingUserReports,
  reviewUserReport,
  getPostReports,
  getPendingPostReports,
  reviewPostReport,
  getBlogReports,
  getPendingBlogReports,
  reviewBlogReport,
};

module.exports = reportController;