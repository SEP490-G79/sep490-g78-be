const express = require ("express");
const postRouter = express.Router({ mergeParams: true });
const bodyParser = require("body-parser");
const {verifyAccessToken, optionalVerifyAccessToken} = require("../middlewares/auth.middleware");
const cloudinary = require("../configs/cloudinary");
const { postController } = require("../controllers");
postRouter.use(bodyParser.json());

postRouter.get("/get-posts-list", optionalVerifyAccessToken, postController.getPostsList);
postRouter.get("/:postId", optionalVerifyAccessToken, postController.getPostDetail);
postRouter.post("/create",
  verifyAccessToken,
  cloudinary.upload.array("photos", 5),
  (err, req, res, next) => {
    if (err?.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ message: "Tối đa 5 ảnh được phép đăng." });
    }
    next();
  },
  postController.createPost
);

postRouter.put("/:postId/edit",
  verifyAccessToken,
  cloudinary.upload.array("photos", 5),
  (err, req, res, next) => {
    if (err?.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ message: "Chỉ được tải lên tối đa 5 ảnh." });
    }
    next();
  },
  postController.editPost
);
postRouter.delete("/:postId/delete", verifyAccessToken, postController.deletePost);
postRouter.post("/react/:postId", verifyAccessToken, postController.reactPost);
postRouter.post("/:postId/report",
  verifyAccessToken,
  cloudinary.upload.array("photos", 5),
  (err, req, res, next) => {
    if (err?.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ message: "Chỉ được tải lên tối đa 5 ảnh." });
    }
    next();
  },
  postController.reportPost
);
postRouter.post("/:postId/comment",verifyAccessToken,  postController.createComment);
postRouter.put("/:postId/comment/edit/:commentId",verifyAccessToken, postController.editComment);
postRouter.delete("/:postId/comment/:commentId",verifyAccessToken, postController.removeComment);
postRouter.get("/:postId/comments", optionalVerifyAccessToken, postController.getCommentsByPost);

module.exports = postRouter;