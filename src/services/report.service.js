const {Report, User, Post, Blog, Shelter} = require("../models/index")
const {cloudinary} = require("../configs/cloudinary")
const fs = require("fs")
const {createNotification} = require("./notification.service")
const {mailer} = require("../configs/index")

const safeUser = (user) => ({
  _id: user?._id ?? null,
  fullName: user?.fullName ?? "",
  email: user?.email ?? "",
  avatar: user?.avatar ?? "",
  phoneNumber: user?.phoneNumber ?? "",
  dob: user?.dob ?? null,
  bio: user?.bio ?? "",
  address: user?.address ?? "",
  background: user?.background ?? "",
  location: {
    lat: user?.location?.lat ?? 0,
    lng: user?.location?.lng ?? 0,
  },
  warningCount: user?.warningCount ?? 0,
  createdAt: user?.createdAt ?? null,
  updatedAt: user?.updatedAt ?? null,
});

const safeShelter = (shelter) => {
  if (!shelter) return null;
  return {
    _id: shelter._id || null,
    name: shelter.name || "",
    avatar: shelter.avatar || "",
    address: shelter.address || "",
  };
};

const safeBlog = (blog) => {
  if (!blog) return null;
  return {
    _id: blog._id || null,
    title: blog.title || "",
    description: blog.description || "",
    content: blog.content || "",
    thumbnail_url: blog.thumbnail_url || "https://drmango.vn/img/noimage-600x403-1.jpg",
    status: ["moderating", "published", "rejected", "deleted"].includes(blog.status)
      ? blog.status
      : "moderating",
    createdAt: blog.createdAt || null,
    updatedAt: blog.updatedAt || null,
    shelter: safeShelter(blog.shelter),
    createdBy: safeUser(blog.createdBy),
  };
};


//USER
async function reportUser(reporterId, { userId, reportType, reason }, files) {
  try {
    if(reporterId === userId){
      throw new Error("Không thể tự báo cáo chính mình");
    }

    const report = await Report.findOne({ reportedBy: reporterId, user: userId, status: "pending" });
    if (report) {
      throw new Error("Vui lòng chờ duyệt báo cáo trước đó");
    }

    const reportedUser = await User.findById(userId);
    if (!reportedUser) {
      throw new Error("Không tìm thấy user");
    }

    const hasPhotos = Array.isArray(files?.photos) && files.photos.length > 0;
    let tempFilePaths = [];
    let uploadImages = [];

    if (hasPhotos) {
      try {
        for (const photo of files.photos) {
          tempFilePaths.push(photo.path);
          const uploadResult = await cloudinary.uploader.upload(photo.path, {
            folder: "report_photos",
            resource_type: "image",
          });
          uploadImages.push(uploadResult.secure_url);

          // Xóa file local sau khi upload
          fs.unlink(photo.path, (err) => {
            if (err) console.error("Error deleting local photo file:", err);
          });
        }
      } catch (error) {
        console.error("Cloudinary Upload Error:", error);

        for (const filePath of tempFilePaths) {
          fs.unlink(filePath, (err) => {
            if (err) console.error("Error deleting file in catch:", filePath, err);
          });
        }

        throw new Error("Lỗi khi tải lên ảnh report. Vui lòng thử lại.");
      }
    }

    await Report.create({
      reportedBy: reporterId,
      user: userId,
      reportType,
      reason,
      status: "pending",
      ...(hasPhotos ? { photos: uploadImages } : {}),
    });

    return {
      status: 200,
      message: "Báo cáo user thành công!",
    };
  } catch (error) {
    throw error;
  }
}
async function reportPost(reporterId, { postId, reportType, reason }, files) {
  try {
    const report = await Report.findOne({ reportedBy: reporterId, post: postId, status: "pending" });
    if (report) {
      throw new Error("Vui lòng chờ duyệt báo cáo trước đó");
    }

    const reportedPost = await Post.findById(postId);
    if (!reportedPost) {
      throw new Error("Không tìm thấy post");
    }
    if(String(reportedPost.createdBy._id) === String(reporterId)){
      throw new Error("Không thể tự báo cáo bài viết của chính mình")
    }

    let tempFilePaths = [];
    let uploadImages = [];

    const hasPhotos = Array.isArray(files?.photos) && files.photos.length > 0;

    if (hasPhotos) {
      for (const photo of files.photos) {
        tempFilePaths.push(photo.path);
      }

      try {
        for (const photo of files.photos) {
          const uploadResult = await cloudinary.uploader.upload(photo.path, {
            folder: "report_photos",
            resource_type: "image",
          });
          uploadImages.push(uploadResult.secure_url);
          fs.unlink(photo.path, (err) => {
            if (err) console.error("Error deleting local photo file:", err);
          });
        }
      } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        for (const filePath of tempFilePaths) {
          fs.unlink(filePath, (err) => {
            if (err) console.error("Error deleting file in catch:", filePath, err);
          });
        }
        throw new Error("Lỗi khi tải lên ảnh report. Vui lòng thử lại.");
      }
    }

    await Report.create({
      reportedBy: reporterId,
      post: postId,
      reportType,
      reason,
      status: "pending",
      ...(hasPhotos ? { photos: uploadImages } : {}),
    });

    return {
      status: 200,
      message: "Báo cáo bài viết thành công!",
    };
  } catch (error) {
    throw error;
  }
}
async function reportBlog(reporterId, { blogId, reportType, reason }, files) {
  try {
    // 1. Không được tự báo cáo blog của chính mình
    const reportedBlog = await Blog.findById(blogId).populate("createdBy");
    if (!reportedBlog) {
      throw new Error("Không tìm thấy bài viết blog");
    }
    if (String(reportedBlog.createdBy._id) === String(reporterId)) {
      throw new Error("Không thể tự báo cáo bài viết blog của chính mình");
    }

    // 2. Kiểm tra đã tồn tại báo cáo đang chờ hay chưa
    const existingReport = await Report.findOne({
      reportedBy: reporterId,
      blog: blogId,
      status: "pending",
    });
    if (existingReport) {
      throw new Error("Vui lòng chờ duyệt báo cáo trước đó");
    }

    // 3. Xử lý ảnh đính kèm
    const hasPhotos = Array.isArray(files?.photos) && files.photos.length > 0;
    const tempFilePaths = [];
    const uploadImages = [];

    if (hasPhotos) {
      try {
        for (const photo of files.photos) {
          tempFilePaths.push(photo.path);

          const uploadResult = await cloudinary.uploader.upload(photo.path, {
            folder: "report_photos",
            resource_type: "image",
          });
          uploadImages.push(uploadResult.secure_url);

          fs.unlink(photo.path, (err) => {
            if (err) console.error("Error deleting local file:", err);
          });
        }
      } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        for (const path of tempFilePaths) {
          fs.unlink(path, (err) => {
            if (err) console.error("Error deleting file in catch:", path, err);
          });
        }
        throw new Error("Lỗi khi tải lên ảnh report. Vui lòng thử lại.");
      }
    }

    // 4. Tạo báo cáo
    await Report.create({
      reportedBy: reporterId,
      blog: blogId,
      reportType,
      reason,
      status: "pending",
      ...(hasPhotos ? { photos: uploadImages } : {}),
    });

    return {
      status: 200,
      message: "Báo cáo bài viết blog thành công!",
    };
  } catch (error) {
    throw error;
  }
}



//ADMIN
async function getUserReports() {
  try {
    const reports = await Report.find({
      reportType: "user",
      status: { $ne: "pending" },
    })
      .populate("user reportedBy reviewedBy")
      .sort({ createdAt: -1 });

    return reports.map((report) => ({
      _id: report._id,
      reportType: report.reportType,
      user: safeUser(report.user),
      reportedBy: safeUser(report.reportedBy),
      reviewedBy: safeUser(report.reviewedBy),
      reason: report.reason ?? "",
      photos: report.photos ?? [],
      status: report.status ?? "pending",
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }));

  } catch (error) {
    throw error;
  }
}
async function getPendingUserReports() {
  try {
    const reports = await Report.find({
      reportType: "user",
      status: "pending",
    })
      .populate("user reportedBy reviewedBy")
      .sort({ createdAt: -1 });

    return reports.map((report) => ({
      _id: report._id,
      reportType: report.reportType,
      user: safeUser(report.user),
      reportedBy: safeUser(report.reportedBy),
      reviewedBy: safeUser(report.reviewedBy),
      reason: report.reason ?? "",
      photos: report.photos ?? [],
      status: report.status ?? "pending",
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }));

  } catch (error) {
    throw error;
  }
}
async function reviewUserReport(adminId, reportId, decision = "reject") {
  try {
    // 1. Tìm báo cáo
    const report = await Report.findById(reportId).populate("user reportedBy");
    if (!report) {
      throw new Error("Id báo cáo không hợp lệ");
    }

    if (report.status !== "pending") {
      throw new Error("Báo cáo đã được xử lý");
    }

    // 2. Tìm người dùng bị báo cáo
    const reportedUser = await User.findById(report.user._id);
    if (!reportedUser) {
      throw new Error("Id tài khoản bị báo cáo không hợp lệ");
    }

    // 3. Xử lý từ chối báo cáo
    if (decision === "reject") {
      report.status = "rejected";
      report.reviewedBy = adminId;
      await report.save();

      return {
        message: "Xử lý báo cáo tài khoản thành công!",
      };
    }

    // 4. Phê duyệt báo cáo
    report.status = "approved";
    report.reviewedBy = adminId;
    reportedUser.warningCount++;
    if(reportedUser.warningCount >= 3){
      reportedUser.status = "banned";
    }

    await report.save();
    const updatedUser = await reportedUser.save();

    // 5. Tìm thông tin admin để dùng trong email
    const adminUser = await User.findById(adminId);

    // 6. Gửi thông báo
    if(updatedUser.warningCount < 3){
      await createNotification(
      adminId,
      [report.user._id],
      `Tài khoản của bạn đã bị xác nhận vi phạm sau khi bị người dùng khác báo cáo.\nLý do: ${report.reason}.`,
      "report",
      "#"
    );
    }
    

    // 7. Khóa tài khoản nếu quá 3 cảnh cáo
    if (updatedUser.warningCount >= 3) {
      const emailTitle = "Tài khoản của bạn đã bị khóa do vi phạm quy định";
      const emailToSend = `
Kính gửi ${updatedUser.fullName},

Chúng tôi xin thông báo rằng tài khoản của bạn trên hệ thống PawShelter đã bị **tạm khóa** do đã vi phạm quy định cộng đồng **3 lần**.

🔒 Thông tin vi phạm gần nhất:
- Thời điểm vi phạm: ${report.createdAt.toLocaleString("vi-VN", { dateStyle: "full" })}
- Lý do: ${report.reason}
- Tổng số lần vi phạm: 3 lần

Tài khoản của bạn sẽ không thể tiếp tục đăng nhập hoặc sử dụng dịch vụ từ thời điểm này.

📩 Nếu bạn có khiếu nại hoặc cần hỗ trợ, vui lòng liên hệ quản trị viên qua email: ${adminUser.email}

Trân trọng,  
PawShelter
      `.trim();

      await mailer.sendEmail(updatedUser.email, emailTitle, emailToSend);
    }

    return {
      message: "Xử lý báo cáo tài khoản thành công!",
    };
  } catch (error) {
    throw error;
  }
}

async function getPostReports() {
  try {
    const reports = await Report.find({
      reportType: "post",
      status: {$ne: "pending"},
    })
      .populate("post reportedBy reviewedBy")
      .populate({
        path: "post",
        populate: { path: "createdBy", select: "_id fullName email avatar" },
      })
      .sort({ createdAt: -1 });

    return reports.map((report) => ({
      _id: report._id,
      reportType: report.reportType,
      post: {
        _id: report.post._id,
        title: report.post.title,
        photos: report.post.photos,
        privacy: report.post.privacy,
        createdBy: safeUser(report.post.createdBy),
        status: report.post.status,
        createdAt: report.post.createdAt,
        updatedAt: report.post.updatedAt,
      },
      reportedBy: safeUser(report.reportedBy),
      reviewedBy: safeUser(report.reviewedBy),
      reason: report.reason ?? "",
      photos: report.photos ?? [],
      status: report.status ?? "pending",
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }));

  } catch (error) {
    throw error;
  }
}
async function getPendingPostReports() {
  try {
    const reports = await Report.find({
      reportType: "post",
      status: "pending",
    })
      .populate("post reportedBy reviewedBy")
      .populate({
        path: "post",
        populate: { path: "createdBy", select: "_id fullName email avatar" },
      })
      .sort({ createdAt: -1 });

    return reports.map((report) => ({
      _id: report._id,
      reportType: report.reportType,
      post: {
        _id: report.post._id,
        title: report.post.title,
        photos: report.post.photos,
        privacy: report.post.privacy,
        createdBy: safeUser(report.post.createdBy),
        status: report.post.status,
        createdAt: report.post.createdAt,
        updatedAt: report.post.updatedAt,
      },
      reportedBy: safeUser(report.reportedBy),
      reviewedBy: safeUser(report.reviewedBy),
      reason: report.reason ?? "",
      photos: report.photos ?? [],
      status: report.status ?? "pending",
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }));

  } catch (error) {
    throw error;
  }
}
async function reviewPostReport(adminId, reportId, decision = "reject") {
  try {
    // 1. Tìm báo cáo
    const report = await Report.findById(reportId).populate("post reportedBy");
    if (!report) {
      throw new Error("Id báo cáo không hợp lệ");
    }

    if (report.status !== "pending") {
      throw new Error("Báo cáo đã được xử lý");
    }

    // 2. Tìm bài post bị báo cáo
    const reportedPost = await Post.findById(report.post._id);
    if (!reportedPost) {
      throw new Error("Id bài post bị báo cáo không hợp lệ");
    }

    // 3. Xử lý từ chối báo cáo
    if (decision === "reject") {
      report.status = "rejected";
      report.reviewedBy = adminId;
      await report.save();

      return {
        message: "Xử lý báo cáo bài post thành công!",
      };
    }

    // 4. Phê duyệt báo cáo
    report.status = "approved";
    report.reviewedBy = adminId;
    reportedPost.status = "hidden";
    await report.save();
    await reportedPost.save();

    // 5. Gửi thông báo
    try {
      await createNotification(
        adminId,
        [reportedPost.createdBy],
        `Bài viết của bạn đã bị xác nhận vi phạm sau khi bị người dùng khác báo cáo.\nLý do: ${report.reason}.`,
        "report",
        "#"
      );
    } catch (error) {
      console.log(error);
    }
    
  
    return {
      message: "Xử lý báo cáo bài post thành công!",
    };
  } catch (error) {
    throw error;
  }
}

async function getBlogReports() {
  try {
    const reports = await Report.find({
      reportType: "blog",
      status: {$ne: "pending"},
    })
      .populate("blog reportedBy reviewedBy")
      .populate({
        path: "blog",
        populate: { path: "createdBy", select: "_id fullName email avatar" },
      })
      .populate({
        path: "blog",
        populate: { path: "shelter", select: "_id name avatar address" },
      })
      .sort({ createdAt: -1 });

    return reports.map((report) => ({
      _id: report._id,
      reportType: report.reportType,
      blog: safeBlog(report.blog),
      reportedBy: safeUser(report.reportedBy),
      reviewedBy: safeUser(report.reviewedBy),
      reason: report.reason ?? "",
      photos: report.photos ?? [],
      status: report.status ?? "pending",
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }));

  } catch (error) {
    throw error;
  }
}
async function getPendingBlogReports() {
  try {
    const reports = await Report.find({
      reportType: "blog",
      status: "pending",
    })
      .populate("blog reportedBy reviewedBy")
      .populate({
        path: "blog",
        populate: { path: "createdBy", select: "_id fullName email avatar" },
      })
      .populate({
        path: "blog",
        populate: { path: "shelter", select: "_id name avatar address" },
      })
      .sort({ createdAt: -1 });

    return reports.map((report) => ({
      _id: report._id,
      reportType: report.reportType,
      blog: safeBlog(report.blog),
      reportedBy: safeUser(report.reportedBy),
      reviewedBy: safeUser(report.reviewedBy),
      reason: report.reason ?? "",
      photos: report.photos ?? [],
      status: report.status ?? "pending",
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }));

  } catch (error) {
    throw error;
  }
}
async function reviewBlogReport(adminId, reportId, decision = "reject") {
  try {
    // 1. Tìm báo cáo
    const report = await Report.findById(reportId).populate("blog reportedBy");
    if (!report) {
      throw new Error("Id báo cáo không hợp lệ");
    }

    if (report.status !== "pending") {
      throw new Error("Báo cáo đã được xử lý");
    }

    // 2. Tìm bài viết blog bị báo cáo
    const reportedBlog = await Blog.findById(report.blog._id);
    if (!reportedBlog) {
      throw new Error("Id bài viết blog bị báo cáo không hợp lệ");
    }
    const relatedShelter = await Shelter.findById(reportedBlog.shelter);
    if(!relatedShelter){
      throw new Error("Không tìm thấy trạm cứu hộ blog thuộc về");
    }

    // 3. Xử lý từ chối báo cáo
    if (decision === "reject") {
      report.status = "rejected";
      report.reviewedBy = adminId;
      await report.save();

      return {
        message: "Xử lý báo cáo bài viết blog thành công!",
      };
    }

    // 4. Phê duyệt báo cáo
    report.status = "approved";
    report.reviewedBy = adminId;
    reportedBlog.status = "deleted";
    await report.save();
    await reportedBlog.save();

    // 5. Gửi thông báo
    try {
      await createNotification(
        adminId,
        [...relatedShelter.members],
        `Bài viết blog của trạm cứu hộ ${relatedShelter.name} tên ${reportedBlog.title} đã bị xác nhận vi phạm sau khi bị người dùng khác báo cáo và đã bị xóa khỏi hệ thống.\nLý do: ${report.reason}.`,
        "report",
        "#"
      );
    } catch (error) {
      console.log(error);
    }
    
  
    return {
      message: "Xử lý báo cáo bài viết blog thành công!",
    };
  } catch (error) {
    throw error;
  }
}

const reportService = {
  //USER
  reportUser,
  reportPost,
  reportBlog,

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

module.exports = reportService;
