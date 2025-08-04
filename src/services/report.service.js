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
    if(reportedUser.status !== "active"){
      throw new Error("Chỉ có thể báo cáo tài khoản đang ở trạng thái active")
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
    if(reportedPost.status !== "active"){
      throw new Error("Chỉ có thể báo bài viết đang ở trạng thái active")
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
    if(reportedBlog.status !== "published"){
      throw new Error("Chỉ có thể báo cáo bài viết blog đang ở trạng thái published")
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
    const report = await Report.findById(reportId).populate("user reportedBy");
    if (!report) {
      throw new Error("Id báo cáo không hợp lệ");
    }
    if (report.status !== "pending") {
      throw new Error("Báo cáo đã được xử lý");
    }
    const reportedUser = await User.findById(report.user._id);
    if (!reportedUser) {
      throw new Error("Id tài khoản bị báo cáo không hợp lệ");
    }
    const adminUser = await User.findById(adminId);
    if (!adminUser) {
      throw new Error("Tài khoản của người duyệt báo cáo không hợp lệ");
    }

    // Xử lý từ chối
    if (decision === "reject") {
      await Report.findByIdAndUpdate(report._id, {
        status: "rejected",
        reviewedBy: adminId,
      });
    } else {
      // Xử lý chấp thuận
      await Report.updateMany(
        { user: report.user._id, status: "pending" },
        {
          $set: {
            status: "approved",
            reviewedBy: adminId,
            updatedAt: new Date(),
          },
        }
      );

      // Cập nhập warningCount và status nếu >= 3
      reportedUser.warningCount++;
      if (reportedUser.warningCount >= 3) {
        reportedUser.status = "banned"; // Ban user nếu warningCount từ 3 trở lên
      }
      const updatedUser = await reportedUser.save();

      // Gửi notification đến tài khoản bị vi phạm nếu chưa bị banned
      if (updatedUser.status !== "banned") {
        await createNotification(
          adminId,
          [report.user._id],
          `Tài khoản của bạn đã bị xác nhận vi phạm sau khi bị người dùng khác báo cáo.\nLý do: ${report.reason}.`,
          "report",
          "#"
        );
      }

      // Gửi mail cho tài khoản bị báo cáo nếu bị ban
      if (updatedUser.status === "banned") {
        const emailTitle = "Tài khoản của bạn đã bị khóa do vi phạm quy định";
        const emailToSend = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <p>Chào <strong>${updatedUser.fullName}</strong>,</p>

    <p>
      Chúng tôi xin thông báo rằng tài khoản của bạn trên hệ thống 
      <strong style="color: #4CAF50;">PawShelter</strong> đã bị 
      <span style="color: red; font-weight: bold;">tạm khóa</span> do đã 
      vi phạm quy định cộng đồng <strong>3 lần</strong>.
    </p>

    <p><strong>Thông tin vi phạm gần nhất:</strong></p>
    <ul style="padding-left: 20px;">
      <li><strong>Thời điểm vi phạm:</strong> ${report.createdAt.toLocaleString(
        "vi-VN",
        { dateStyle: "full" }
      )}</li>
      <li><strong>Lý do:</strong> ${report.reason}</li>
      <li><strong>Tổng số lần vi phạm:</strong> <span style="color: red;">3 lần</span></li>
    </ul>

    <p style="color: #c0392b; font-weight: 500;">
      Tài khoản của bạn sẽ không thể tiếp tục đăng nhập hoặc sử dụng dịch vụ kể từ thời điểm này.
    </p>

    <hr style="border: none; border-top: 1px solid #ccc; margin: 24px 0;" />

    <p>
      Nếu bạn có bất kỳ khiếu nại hoặc cần hỗ trợ, vui lòng liên hệ quản trị viên tại: 
      <a href="mailto:${adminUser.email}" style="color: #1a73e8;">${
          adminUser.email
        }</a>
    </p>

    <p style="margin-top: 24px;">
      Trân trọng,<br />
      <strong style="color: #4CAF50;">PawShelter Team</strong>
    </p>
  </div>
`;

        await mailer.sendEmail(updatedUser.email, emailTitle, emailToSend);
      }
    }

    // Gửi mail cho tài khoản báo cáo
    const reportedByEmailTitle = `Báo cáo của bạn về tài khoản ${report.user.fullName} đã được xử lý`;
    const reportedByEmailBody = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <p>Chào <strong>${report.reportedBy.fullName}</strong>,</p>

    <p>
      Báo cáo của bạn về tài khoản <strong>${
        report.user.fullName
      }</strong> đã được 
      xử lý bởi đội ngũ quản trị <strong>PawShelter</strong>.
    </p>

    <p><strong>Thông tin chi tiết báo cáo:</strong></p>
    <ul style="padding-left: 20px;">
      <li><strong>Tài khoản bị báo cáo:</strong> ${report.user.fullName}</li>
      <li><strong>Thời gian gửi báo cáo:</strong> ${new Date(
        report.createdAt
      ).toLocaleString("vi-VN")}</li>
      ${
        decision === "approve"
          ? '<li><strong>Trạng thái:</strong> <span style="color: green;">Chấp thuận</span></li>'
          : '<li><strong>Trạng thái:</strong> <span style="color: red;">Từ chối</span></li>'
      }
      <li><strong>Duyệt vào:</strong> ${new Date().toLocaleString("vi-VN")}</li>
    </ul>

    <p>
      Cảm ơn bạn đã góp phần xây dựng một cộng đồng văn minh và an toàn. Chúng tôi đánh giá cao sự hợp tác của bạn.
    </p>

    <hr style="border: none; border-top: 1px solid #ccc;" />

    <p>
      📩 Nếu bạn có bất kỳ thắc mắc hoặc cần hỗ trợ thêm, vui lòng liên hệ quản trị viên tại: 
      <a href="mailto:${adminUser.email}" style="color: #1a73e8;">${
      adminUser.email
    }</a>
    </p>

    <p style="margin-top: 24px;">
      Trân trọng,<br />
      <strong style="color: #4CAF50;">PawShelter Team</strong>
    </p>
  </div>
`;

    // tạo notification cho tài khoản báo cáo
    await createNotification(
      adminId,
      [report.reportedBy._id],
      `Báo cáo của bạn về tài khoản ${report.user.fullName} đã được xử lý.\n Vui lòng kiểm trả email để xem chi tiết`,
      "report",
      "#"
    );

    // Gửi mail cho tài khoản báo cáo (chi tiết về report sau khi duyệt)
    await mailer.sendEmail(
      report.reportedBy.email,
      reportedByEmailTitle,
      reportedByEmailBody
    );

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
    const report = await Report.findById(reportId).populate("post reportedBy");
    if (!report) {
      throw new Error("Id báo cáo không hợp lệ");
    }
    if (report.status !== "pending") {
      throw new Error("Báo cáo đã được xử lý");
    }
    const reportedPost = await Post.findById(report.post._id);
    if (!reportedPost) {
      throw new Error("Id bài post bị báo cáo không hợp lệ");
    }
    const adminUser = await User.findById(adminId);
    if (!adminUser) {
      throw new Error("Tài khoản của người duyệt báo cáo không hợp lệ");
    }

    // Xử lý từ chối báo cáo
    if (decision === "reject") {
      await Report.findByIdAndUpdate(reportId, {status: "rejected", reviewedBy: adminId});
    } else {
      // Xử lý chấp thuận báo cáo
      await Post.findByIdAndUpdate(reportedPost._id, {status: "hidden"})
      await Report.updateMany(
        { post: report.post._id, status: "pending" },
        {
          $set: {
            status: "approved",
            reviewedBy: adminId,
            updatedAt: new Date(),
          },
        }
      );
      // Gửi notification cho người tạo bài viết post
      await createNotification(
        adminId,
        [reportedPost.createdBy],
        `Bài viết của bạn đã bị xác nhận vi phạm sau khi bị người dùng khác báo cáo.\nLý do: ${report.reason}.`,
        "report",
        "#"
      );
    }

    // Mail để gửi cho tài khoản báo cáo bài viết post
    const reportedByEmailTitle = `Báo cáo của bạn về bài viết post ${report.post.title} đã được xử lý`;
    const reportedByEmailBody = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <p>Chào <strong>${report.reportedBy.fullName}</strong>,</p>

    <p>
      Báo cáo của bạn về bài viết post <strong>${
        report.post.title
      }</strong> đã được 
      duyệt bởi đội ngũ quản trị <strong>PawShelter</strong>.
    </p>

    <p><strong>Thông tin chi tiết báo cáo:</strong></p>
    <ul style="padding-left: 20px;">
      <li><strong>Bài viết post bị báo cáo:</strong> ${report.post.title}</li>
      <li><strong>Thời gian gửi báo cáo:</strong> ${new Date(
        report.createdAt
      ).toLocaleString("vi-VN")}</li>
      ${
        decision === "approve"
          ? '<li><strong>Trạng thái:</strong> <span style="color: green;">Chấp thuận</span></li>'
          : '<li><strong>Trạng thái:</strong> <span style="color: red;">Từ chối</span></li>'
      }
      <li><strong>Duyệt vào:</strong> ${new Date().toLocaleString("vi-VN")}</li>
    </ul>

    <p>
      Cảm ơn bạn đã góp phần xây dựng một cộng đồng văn minh và an toàn. Chúng tôi đánh giá cao sự hợp tác của bạn.
    </p>

    <hr style="border: none; border-top: 1px solid #ccc;" />

    <p>
      📩 Nếu bạn có bất kỳ thắc mắc hoặc cần hỗ trợ thêm, vui lòng liên hệ quản trị viên tại: 
      <a href="mailto:${adminUser.email}" style="color: #1a73e8;">${
      adminUser.email
    }</a>
    </p>

    <p style="margin-top: 24px;">
      Trân trọng,<br />
      <strong style="color: #4CAF50;">PawShelter Team</strong>
    </p>
  </div>
        `;
    // Gửi notification cho tài khoản báo cáo bài viết post
    await createNotification(
      adminId,
      [report.reportedBy._id],
      `Báo cáo của bạn về bài viết post ${report.post.title} đã được duyệt.\n Vui lòng kiểm trả email để xem chi tiết`,
      "report",
      "#"
    );

    // gửi mail thông báo cho người báo cáo bài viết post
    await mailer.sendEmail(
      report.reportedBy.email,
      reportedByEmailTitle,
      reportedByEmailBody
    );

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
    const report = await Report.findById(reportId).populate("blog reportedBy");
    if (!report) {
      throw new Error("Id báo cáo không hợp lệ");
    }
    if (report.status !== "pending") {
      throw new Error("Báo cáo đã được xử lý");
    }
    const reportedBlog = await Blog.findById(report.blog._id);
    if (!reportedBlog) {
      throw new Error("Id bài viết blog bị báo cáo không hợp lệ");
    }
    const relatedShelter = await Shelter.findById(reportedBlog.shelter);
    if (!relatedShelter) {
      throw new Error("Không tìm thấy trạm cứu hộ blog thuộc về");
    }
    const adminUser = await User.findById(adminId);
    if (!adminUser) {
      throw new Error("Tài khoản của người duyệt báo cáo không hợp lệ");
    }

    //Xử lý từ chối báo cáo
    if (decision === "reject") {
      await Report.findByIdAndUpdate(reportId, {
        status: "rejected",
        reviewedBy: adminId,
      });
    } else {
      //Xử lý chấp thuận báo cáo
      await Blog.findByIdAndUpdate(reportedBlog._id, { status: "deleted" });
      await Report.updateMany(
        { blog: report.blog._id, status: "pending" },
        {
          $set: {
            status: "approved",
            reviewedBy: adminId,
            updatedAt: new Date(),
          },
        }
      );

      // gửi notification cho tất cả thành viên trạm cứu hộ thuộc bài blog
      await createNotification(
        adminId,
        [...relatedShelter.members],
        `Trạm của bạn có một bài blog bị vi phạm và đã bị xóa khỏi hệ thống.\nLý do: ${report.reason}.`,
        "report",
        "#"
      );
    }

    // Mail để gửi cho tài khoản báo cáo bài viết post
    const reportedByEmailTitle = `Báo cáo của bạn về bài viết blog ${report.blog.title} đã được xử lý`;
    const reportedByEmailBody = `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <p>Chào <strong>${report.reportedBy.fullName}</strong>,</p>

    <p>
      Báo cáo của bạn về bài viết blog <strong>${
        report.blog.title
      }</strong> đã được 
      xử lý bởi đội ngũ quản trị <strong>PawShelter</strong>.
    </p>

    <p><strong>Thông tin chi tiết báo cáo:</strong></p>
    <ul style="padding-left: 20px;">
      <li><strong>Bài viết post bị báo cáo:</strong> ${report.blog.title}</li>
      <li><strong>Thời gian gửi báo cáo:</strong> ${new Date(
        report.createdAt
      ).toLocaleString("vi-VN")}</li>
      ${
        decision === "approve"
          ? '<li><strong>Trạng thái:</strong> <span style="color: green;">Chấp thuận</span></li>'
          : '<li><strong>Trạng thái:</strong> <span style="color: red;">Từ chối</span></li>'
      }
      <li><strong>Duyệt vào:</strong> ${new Date().toLocaleString("vi-VN")}</li>
    </ul>

    <p>
      Cảm ơn bạn đã góp phần xây dựng một cộng đồng văn minh và an toàn. Chúng tôi đánh giá cao sự hợp tác của bạn.
    </p>

    <hr style="border: none; border-top: 1px solid #ccc;" />

    <p>
      📩 Nếu bạn có bất kỳ thắc mắc hoặc cần hỗ trợ thêm, vui lòng liên hệ quản trị viên tại: 
      <a href="mailto:${adminUser.email}" style="color: #1a73e8;">${
      adminUser.email
    }</a>
    </p>

    <p style="margin-top: 24px;">
      Trân trọng,<br />
      <strong style="color: #4CAF50;">PawShelter Team</strong>
    </p>
  </div>
        `;
    // Gửi notification cho tài khoản báo cáo bài viết blog
    await createNotification(
      adminId,
      [report.reportedBy._id],
      `Báo cáo của bạn về bài viết blog ${report.blog.title} đã được duyệt.\n Vui lòng kiểm trả email để xem chi tiết`,
      "report",
      "#"
    );

    // gửi mail thông báo cho người báo cáo bài viết post
    await mailer.sendEmail(
      report.reportedBy.email,
      reportedByEmailTitle,
      reportedByEmailBody
    );

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
