const returnRequestService = require("../services/returnRequest.service");
const fs = require("fs/promises");

const createReturnRequest = async (req, res) => {
  try {
    const userId = req.payload.id;
    const createData = req.body;
    const files = req.files;

    const result = await returnRequestService.createReturnRequest(
      userId,
      createData,
      files
    );
    res.status(201).json(result);
  } catch (error) {
    if (req.files?.length) {
      await Promise.allSettled(
        req.files.map((file) => fs.unlink(file.path).catch(() => {}))
      );
    }
    console.error("Error creating return request:", error.message);
    res.status(400).json({ error: error.message });
  }
};

const updateReturnRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.payload?.id;
    const updateData = req.body;
    const files = req.files;

    if (!requestId || !userId) {
      return res.status(400).json({ error: "Thiếu requestId hoặc userId" });
    }

    const updatedRequest = await returnRequestService.updateReturnRequest(
      requestId,
      userId,
      updateData,
      files
    );

    res.status(200).json({
      message: "Cập nhật yêu cầu trả thú cưng thành công",
      data: updatedRequest,
    });
  } catch (error) {
     if (req.files?.length) {
      await Promise.allSettled(
        req.files.map((file) => fs.unlink(file.path).catch(() => {}))
      );
    }
    console.error("Error updating return request:", error.message);
    res.status(400).json({ error: error.message });
  }
};

// const getReturnRequests = async (req, res) => {
//   try {
//     const { userId, shelterId } = req.query;
//     const data = await returnRequestService.getReturnRequests({
//       userId,
//       shelterId,
//     });
//     res.status(200).json(data);
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

const getReturnRequestsByUser = async (req, res) => {
  try {
    const userId = req.payload.id;
    const result = await returnRequestService.getReturnRequestsByUser(userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getReturnRequestsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await returnRequestService.getReturnRequestsByUserId(userId);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getReturnRequestsByShelter = async (req, res) => {
  try {
    const { shelterId } = req.params;
    const result = await returnRequestService.getReturnRequestsByShelter(
      shelterId
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteReturnRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.payload.id;

    const result = await returnRequestService.deleteReturnRequest(
      requestId,
      userId
    );
    res.status(200).json({
      message: "Đã huỷ yêu cầu",
      data: result,
    });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
};

const approveReturnRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const shelterUserId = req.payload.id;

    const result = await returnRequestService.approveReturnRequest(
      requestId,
      shelterUserId
    );
    res
      .status(200)
      .json({ message: "Yêu cầu đã được chấp thuận", data: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const rejectReturnRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const shelterUserId = req.payload.id;
    const { rejectReason } = req.body;

    const result = await returnRequestService.rejectReturnRequest(
      requestId,
      shelterUserId,
      rejectReason
    );
    res.status(200).json({ message: "Yêu cầu đã bị từ chối", data: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const returnRequestController = {
  createReturnRequest,
  updateReturnRequest,
  //getReturnRequests,
  getReturnRequestsByUser,
  getReturnRequestsByUserId,
  getReturnRequestsByShelter,
  deleteReturnRequest,
  approveReturnRequest,
  rejectReturnRequest,
};

module.exports = returnRequestController;
