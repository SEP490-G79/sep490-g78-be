const express = require("express");
const reportRouter = express.Router();
const bodyParser = require("body-parser");
const {verifyAccessToken, isActive} = require("../middlewares/auth.middleware")
const {isAdmin} = require("../middlewares/admin.middleware");
const reportController = require("../controllers/report.controller");
const { cloudinary } = require("../configs");

reportRouter.use(bodyParser.json());

//USER
reportRouter.post("/report-user", 
    [verifyAccessToken, isActive],
    cloudinary.upload.fields([
    { name: "photos", maxCount: 5 },
  ]), reportController.reportUserById)
reportRouter.post("/report-post", 
    [verifyAccessToken, isActive],
    cloudinary.upload.fields([
    { name: "photos", maxCount: 5 },
  ]), reportController.reportPostById)
  reportRouter.post("/report-blog", 
    [verifyAccessToken, isActive],
    cloudinary.upload.fields([
    { name: "photos", maxCount: 5 },
  ]), reportController.reportBlogById)

//ADMIN
reportRouter.get("/admin/get-user-reports", [verifyAccessToken, isActive, isAdmin], reportController.getUserReports);
reportRouter.get("/admin/get-pending-user-reports", [verifyAccessToken, isActive, isAdmin], reportController.getPendingUserReports);
reportRouter.put("/admin/review/user/:reportId/:decision", [verifyAccessToken, isActive, isAdmin], reportController.reviewUserReport);

reportRouter.get("/admin/get-post-reports", [verifyAccessToken, isActive, isAdmin], reportController.getPostReports);
reportRouter.get("/admin/get-pending-post-reports", [verifyAccessToken, isActive, isAdmin], reportController.getPendingPostReports);
reportRouter.put("/admin/review/post/:reportId/:decision", [verifyAccessToken, isActive, isAdmin], reportController.reviewPostReport);
reportRouter.get("/admin/get-blog-reports", [verifyAccessToken, isActive, isAdmin], reportController.getBlogReports);
reportRouter.get("/admin/get-pending-blog-reports", [verifyAccessToken, isActive, isAdmin], reportController.getPendingBlogReports);
reportRouter.put("/admin/review/blog/:reportId/:decision", [verifyAccessToken, isActive, isAdmin], reportController.reviewBlogReport);

module.exports = reportRouter;