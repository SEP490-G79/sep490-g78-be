const express = require("express");
const breedRouter = express.Router();
const { getAllBreeds } = require("../controllers/breed.controller");
const breedController = require("../controllers/breed.controller");
const {authMiddleware, adminMiddleware} = require("../middlewares/index")

breedRouter.get("/getAll", getAllBreeds);

//ADMIN
breedRouter.get("/admin/get-all", [authMiddleware.verifyAccessToken, adminMiddleware.isAdmin], breedController.getAll);
breedRouter.post("/admin/create", [authMiddleware.verifyAccessToken, adminMiddleware.isAdmin], breedController.createBreed);
breedRouter.put("/admin/edit", [authMiddleware.verifyAccessToken, adminMiddleware.isAdmin], breedController.editBreed);
breedRouter.delete("/admin/delete/:breedId", [authMiddleware.verifyAccessToken, adminMiddleware.isAdmin], breedController.deleteBreed);

module.exports = breedRouter;
