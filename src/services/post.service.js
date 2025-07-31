const db = require("../models");
const { cloudinary } = require("../configs/cloudinary");
const fs = require("fs/promises");
const NotificationService = require("./notification.service");

const getPostsList = async (userId, shelterId) => {
  try {
    const filter = {
      status: "active",
      $or: [{ privacy: "public" }],
    };

    if (userId) {
      filter.$or.push({
        $and: [{ privacy: "private" }, { createdBy: userId }],
      });
    }

    if (shelterId) {
      filter.shelter = shelterId;
    }

    const posts = await db.Post.find(filter)
      .populate("createdBy")
      .populate("likedBy")
      .populate("shelter");

    // Dùng Promise.all để lấy latestComment cho từng post
    const result = await Promise.all(
      posts.map(async (post) => {
        const latestComment = await db.Comment.findOne({
          post: post._id,
          status: "visible",
        })
          .sort({ createdAt: -1 })
          .populate("commenter", "fullName avatar");

        return {
          _id: post._id,
          title: post.title,
          createdBy: {
            _id: post.createdBy._id,
            fullName: post.createdBy.fullName,
            avatar: post.createdBy.avatar,
          },
          shelter: post.shelter || null,
          photos: post.photos,
          privacy: post.privacy,
          address: post.address,
          location: post.location,
          likedBy: post.likedBy.map((user) => ({
            _id: user._id,
            fullName: user.fullName,
            avatar: user.avatar,
          })),
          latestComment: latestComment
            ? {
                _id: latestComment._id,
                message: latestComment.message,
                commenter: {
                  _id: latestComment.commenter._id,
                  fullName: latestComment.commenter.fullName,
                  avatar: latestComment.commenter.avatar,
                },
                createdAt: latestComment.createdAt,
              }
            : null,
          status: post.status,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        };
      })
    );

    return result;
  } catch (error) {
    throw error;
  }
};

const getPostDetail = async (postId) => {
  try {
    const post = await db.Post.findById(postId)
      .populate("createdBy")
      .populate("likedBy")
      .populate("shelter");
    if (!post) {
      throw new Error("Post not found");
    }

    return {
      _id: post._id,
      title: post.title,
      createdBy: {
        _id: post.createdBy._id,
        fullName: post.createdBy.fullName,
        avatar: post.createdBy.avatar,
      },
      shelter: post.shelter || null,
      photos: post.photos.map((photo) => photo),
      privacy: post.privacy || "public",
      address: post.address,
      location: post.location,
      likedBy: post.likedBy.map((user) => ({
        _id: user._id,
        fullName: user.fullName,
        avatar: user.avatar,
      })),
      status: post.status,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  } catch (error) {
    throw error;
  }
};

const createPost = async (userId, postData, files) => {
  const uploadedPhotoUrls = [];
  const tempFilePaths = [];
  const shelterId = postData.shelter;

  try {
    let shelterMembers = [];
    let shelterName = "";

    if (shelterId) {
      const shelter = await db.Shelter.findById(shelterId);
      if (!shelter) throw new Error("Không tìm thấy trạm cứu hộ");

      const member = shelter.members.find(
        (m) => m._id.toString() === userId.toString()
      );
      if (!member) throw new Error("Bạn không phải thành viên của shelter này");

      if (
        !member.roles.includes("staff") &&
        !member.roles.includes("manager")
      ) {
        throw new Error("Bạn không có quyền đăng bài trong shelter này");
      }

      // Lấy danh sách thành viên shelter
      shelterMembers = shelter.members
        .filter((m) => m._id.toString() !== userId.toString())
        .map((m) => m._id);

      shelterName = shelter.name;
    }

    // Upload ảnh lên Cloudinary
    if (Array.isArray(files)) {
      for (const file of files) {
        tempFilePaths.push(file.path);
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "posts",
            resource_type: "image",
          });
          uploadedPhotoUrls.push(result.secure_url);
          await fs.unlink(file.path);
        } catch (uploadError) {
          console.error("Upload error:", uploadError);
          await Promise.all(
            tempFilePaths.map((path) => fs.unlink(path).catch(() => {}))
          );
          throw new Error("Lỗi khi upload ảnh lên Cloudinary");
        }
      }
    }

    const parsedLocation =
      typeof postData.location === "string"
        ? JSON.parse(postData.location)
        : postData.location || { lat: 0, lng: 0 };

    const newPost = await db.Post.create({
      createdBy: userId,
      shelter: shelterId || null,
      title: postData.title,
      privacy: postData.privacy || "public",
      address: postData.address || "",
      location: parsedLocation,
      photos: uploadedPhotoUrls,
      status: "active",
    });

    if (shelterMembers.length > 0) {
      await NotificationService.createNotification(
        userId,
        shelterMembers,
        `Thành viên của trạm cứu hộ "${shelterName}" đã đăng bài viết`,
        "system",
        `/newfeed?postId=${newPost._id}`
      );
    }

    return newPost;
  } catch (error) {
    await Promise.all(
      tempFilePaths.map((path) => fs.unlink(path).catch(() => {}))
    );
    throw new Error("Lỗi khi tạo bài viết: " + error.message);
  }
};

const editPost = async (userId, postId, postData, files) => {
  const tempFilePaths = [];
  const uploadedPhotos = [];

  try {
    const post = await db.Post.findById(postId);
    if (!post) throw new Error("Không tìm thấy bài viết");

    // Nếu post thuộc shelter
    if (post.shelter) {
      const shelter = await db.Shelter.findById(post.shelter);
      const member = shelter?.members.find(
        (m) => m._id.toString() === userId.toString()
      );
      if (!member) throw new Error("Bạn không phải thành viên shelter này");

      const isManager = member.roles.includes("manager");
      const isOwner = post.createdBy.toString() === userId.toString();

      if (!isManager && !isOwner) {
        throw new Error("Bạn không có quyền sửa bài viết này");
      }
    } else {
      if (post.createdBy.toString() !== userId.toString()) {
        throw new Error("Bạn không có quyền sửa bài viết này");
      }
    }

    if (Array.isArray(files)) {
      for (const file of files) {
        tempFilePaths.push(file.path);
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "posts",
            resource_type: "image",
          });
          uploadedPhotos.push(result.secure_url);
          await fs.unlink(file.path);
        } catch (uploadErr) {
          console.error("Upload error:", uploadErr);
          await Promise.all(
            tempFilePaths.map((path) => fs.unlink(path).catch(() => {}))
          );
          throw new Error("Không thể upload ảnh mới");
        }
      }
    }

    const keepPhotos = postData.existingPhotos
      ? JSON.parse(postData.existingPhotos)
      : post.photos;

    const parsedLocation =
      typeof postData.location === "string"
        ? JSON.parse(postData.location)
        : postData.location || { lat: 0, lng: 0 };

    const updatedPost = await db.Post.findByIdAndUpdate(
      postId,
      {
        $set: {
          title: postData.title || post.title,
          privacy: postData.privacy || post.privacy,
          photos: [...keepPhotos, ...uploadedPhotos],
          address: postData.address || post.address,
          location: parsedLocation,
        },
      },
      { new: true }
    );

    return updatedPost;
  } catch (error) {
    await Promise.all(
      tempFilePaths.map((path) => fs.unlink(path).catch(() => {}))
    );
    throw new Error("Lỗi khi cập nhật bài viết: " + error.message);
  }
};

const deletePost = async (postId, userId) => {
  try {
    const post = await db.Post.findById(postId);
    if (!post) {
      throw new Error("Post not found");
    }

    if (post.shelter) {
      const shelter = await db.Shelter.findById(post.shelter);
      const member = shelter?.members.find(
        (m) => m._id.toString() === userId.toString()
      );
      const isManager = member?.roles.includes("manager");
      const isOwner = post.createdBy.toString() === userId.toString();

      if (!isManager && !isOwner) {
        throw new Error("Bạn không có quyền xoá bài viết này");
      }
    } else {
      if (post.createdBy.toString() !== userId.toString()) {
        throw new Error("Bạn không có quyền xoá bài viết này");
      }
    }

    post.status = "deleted";
    await post.save();

    return {
      success: true,
      message: "Post deleted successfully",
      data: {
        _id: post._id,
        title: post.title,
        createdBy: {
          _id: post.createdBy._id,
          fullName: post.createdBy.fullName,
          avatar: post.createdBy.avatar,
        },
        status: post.status,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      },
    };
  } catch (error) {
    throw error;
  }
};

const reactPost = async (postId, userId) => {
  try {
    const post = await db.Post.findOne({ _id: postId }).populate("shelter");

    if (!post) {
      throw new Error("Post not found");
    }

    const hasLiked = post.likedBy.includes(userId);

    const update = hasLiked
      ? { $pull: { likedBy: userId } }
      : { $addToSet: { likedBy: userId } };

    const updatedPost = await db.Post.findByIdAndUpdate(postId, update, {
      new: true,
    });

    let receivers = [post.createdBy];
    let actionText = hasLiked ? "bỏ thích" : "thích";

    if (post.shelter) {
      const shelter = await db.Shelter.findById(post.shelter);
      if (shelter) {
        receivers = shelter.members.map((m) => m._id);
      }
    }

    await NotificationService.createNotification(
      userId,
      receivers,
      `${actionText} đã thích bài viết "${updatedPost.title}"`,
      "system",
      `/newfeed?postId=${updatedPost._id}`
    );

    return updatedPost;
  } catch (error) {
    throw new Error("Error reacting to post: " + error.message);
  }
};

const reportPost = async (userId, postId, reason, files) => {
  const tempFilePaths = [];
  const uploadedPhotos = [];

  try {
    if (Array.isArray(files) && files.length > 0) {
      for (const file of files) {
        tempFilePaths.push(file.path);
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "reports",
          resource_type: "image",
        });
        uploadedPhotos.push(result.secure_url);
        fs.unlink(file.path, (err) => {
          if (err) console.error("Lỗi xóa ảnh tạm:", err);
        });
      }
    }

    const newReport = await db.Report.create({
      reportType: "post",
      postReported: postId,
      reportedBy: userId,
      reason,
      photos: uploadedPhotos,
      status: "pending",
    });

    const post = await db.Post.findById(postId).populate("createdBy");

    await NotificationService.createNotification(
      userId,
      [post.createdBy._id],
      `Bạn đã báo cáo bài viết: ${post.title}`,
      "system",
      `/newfeed?postId=${post._id}`
    );

    return newReport;
  } catch (error) {
    for (const path of tempFilePaths) {
      fs.unlink(path, (err) => {
        if (err) console.error("Lỗi xóa ảnh tạm:", err);
      });
    }
    throw new Error("Lỗi khi báo cáo bài viết: " + error.message);
  }
};

const createComment = async ({ postId, userId, message }) => {
  try {
    const comment = await db.Comment.create({
      post: postId,
      commenter: userId,
      message,
    });

    const post = await db.Post.findById(postId).populate("shelter");

    let receivers = [post.createdBy];
    if (post.shelter) {
      const shelter = await db.Shelter.findById(post.shelter);
      if (shelter) {
        receivers = shelter.members.map((m) => m._id);
      }
    }

    await NotificationService.createNotification(
      userId,
      receivers,
      `Đã có bình luận mới trên bài viết: ${post.title}`,
      "system",
      `/newfeed?postId=${post._id}`
    );

    return comment;
  } catch (error) {
    throw new Error("Error creating comment: " + error.message);
  }
};

const editComment = async (commentId, userId, message) => {
  try {
    const comment = await db.Comment.findOneAndUpdate(
      { _id: commentId, commenter: userId },
      { message, updatedAt: new Date() },
      { new: true }
    );

    if (!comment) {
      throw new Error("Comment not found or permission denied");
    }

    return comment;
  } catch (error) {
    throw new Error("Error editing comment: " + error.message);
  }
};

const removeComment = async (commentId, userId) => {
  try {
    const comment = await db.Comment.findOneAndUpdate(
      { _id: commentId, commenter: userId },
      { status: "deleted" },
      { new: true }
    );

    if (!comment) {
      throw new Error("Comment not found or permission denied");
    }

    return comment;
  } catch (error) {
    throw new Error("Error deleting comment: " + error.message);
  }
};

const getCommentsByPost = async (postId) => {
  try {
    const comments = await db.Comment.find({
      post: postId,
      status: "visible",
    })
      .populate("commenter", "fullName avatar")
      .sort({ createdAt: -1 });

    return comments.map((comment) => ({
      _id: comment._id,
      message: comment.message,
      commenter: {
        _id: comment.commenter._id,
        fullName: comment.commenter.fullName,
        avatar: comment.commenter.avatar,
      },
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    }));
  } catch (error) {
    throw new Error("Error fetching comments: " + error.message);
  }
};

const postService = {
  getPostsList,
  getPostDetail,
  createPost,
  editPost,
  deletePost,
  reactPost,
  reportPost,
  createComment,
  editComment,
  removeComment,
  getCommentsByPost,
};

module.exports = postService;
