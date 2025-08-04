const postService = require("../services/post.service");
const fs = require("fs/promises");

const getPostsList = async (req, res) => {
  try {
    const userId = req.payload?.id || null; 
    const shelterId = req.params.shelterId || null;
    const posts = await postService.getPostsList(userId, shelterId);
    return res.status(200).json(posts);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const getPostDetail = async (req, res) => {
  const postId = req.params.postId;
  try {
    const post = await postService.getPostDetail(postId);
    return res.status(200).json(post);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const createPost = async (req, res) => {
  // console.log("Req body:", req.body);
  //   console.log("Req files:", req.files);
  const userId = req.payload.id;
  const postData = req.body;


  if (req.files.length > 5) {
    return res.status(400).json({ message: "Chỉ được tải tối đa 5 ảnh." });
  }
  try {
    const post = await postService.createPost(userId, postData, req.files);
    return res.status(201).json({
      message: "Bài viết đã được tạo thành công",
      data: post,
    });
  } catch (error) {
    if (req.files?.length) {
      await Promise.allSettled(
        req.files.map((file) => fs.unlink(file.path).catch(() => {}))
      );
    }
    console.error("Lỗi khi tạo bài viết:", error.message);
    return res.status(400).json({ message: error.message });
  }
};

const editPost = async (req, res) => {
  // console.log("Req body:", req.body);
  // console.log("Req files:", req.files);
  if (req.files.length > 5) {
    return res.status(400).json({ message: "Chỉ được tải tối đa 5 ảnh." });
  }
  const postId = req.params.postId;
  const postData = req.body;
  const userId = req.payload.id;
  try {
    const post = await postService.editPost(
      userId,
      postId,
      postData,
      req.files
    );
    return res.status(200).json({
      message: "Bài viết đã được cập nhật thành công",
      data: post,
    });
  } catch (error) {
    if (req.files?.length) {
      await Promise.allSettled(
        req.files.map((file) => fs.unlink(file.path).catch(() => {}))
      );
    }
    return res.status(400).json({ message: error.message });
  }
};

const deletePost = async (req, res) => {
  const postId = req.params.postId;
   const userId = req.payload.id;
  try {
    const post = await postService.deletePost(postId, userId);
    return res.status(200).json({
      success: true,
      message: "Bài viết đã được xóa thành công",
      data: post,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const reactPost = async (req, res) => {
  const postId = req.params.postId;
  const userId = req.payload.id;
  try {
    const reaction = await postService.reactPost(postId, userId);
    return res.status(200).json({
      success: true,
      message: "tưong tác bài viết thành công",
      data: reaction,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const reportPost = async (req, res) => {
  const userId = req.payload.id;
  const { reason } = req.body;

  if (!reason || reason.trim() === "") {
    return res.status(400).json({ message: "Lý do báo cáo không được để trống." });
  }

  try {
    const report = await postService.reportPost(userId, req.params.postId, reason, req.files);
    res.status(201).json({
      message: "Báo cáo bài viết thành công",
      data: report,
    });
  } catch (error) {
    if (req.files?.length) {
      await Promise.allSettled(
        req.files.map((file) => fs.unlink(file.path).catch(() => {}))
      );
    }
    res.status(400).json({ message: error.message });
  }
};

const createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { message } = req.body;
    const userId = req.payload.id;

    const comment = await postService.createComment({
      postId,
      userId,
      message,
    });
    res.status(201).json(comment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const editComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { message } = req.body;
    const userId = req.payload.id;

    const updated = await postService.editComment(commentId, userId, message);
    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const removeComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.payload.id;

    const deleted = await postService.removeComment(commentId, userId);
    res.status(200).json(deleted);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getCommentsByPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const comments = await postService.getCommentsByPost(postId);
    res.status(200).json(comments);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const postController = {
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
module.exports = postController;
