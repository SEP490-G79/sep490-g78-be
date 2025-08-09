const fs = require("fs/promises");

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const checkImageSize = async (req, res, next) => {
  try {
    const files = [];

    // .single()
    if (req.file) files.push(req.file);

    // .array()
    if (Array.isArray(req.files)) {
      files.push(...req.files);
    }
    // .fields()
    else if (req.files && typeof req.files === "object") {
      Object.values(req.files).forEach((val) => {
        if (Array.isArray(val)) files.push(...val);
        else if (val && typeof val === "object" && val.path) files.push(val);
      });
    }

    if (!files.length) return next();

    const tooBigFiles = files.filter((f) => Number(f.size) > MAX_FILE_SIZE);

    if (tooBigFiles.length) {
      await Promise.allSettled(
        files.map((f) => fs.unlink(f.path).catch(() => {}))
      );
      return res.status(400).json({
        message:
          "File ảnh vượt quá giới hạn 10MB: " +
          tooBigFiles.map((f) => f.originalname || f.filename).join(", "),
      });
    }

    return next();
  } catch (err) {
    console.error("Error in checkImageSize middleware:", err);
    return next(err);
  }
};

const fileMiddleware = {
  checkImageSize,
};

module.exports = fileMiddleware;
