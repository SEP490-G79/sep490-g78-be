const express = require("express");
const speciesRouter = express.Router();
const {
  getAllSpecies,
  createSpecies,
} = require("../controllers/species.controller");
const Species = require("../models/species.model");
const speciesController = require("../controllers/species.controller");
const { verifyAccessToken } = require("../middlewares/auth.middleware");
const { isAdmin } = require("../middlewares/admin.middleware");


speciesRouter.get("/getAll", getAllSpecies);
speciesRouter.get("/get-all", speciesController.getAll);
speciesRouter.post("/create", createSpecies);

//ADMIN
speciesRouter.get("/admin/get-all", [verifyAccessToken, isAdmin], speciesController.adminGetAll)
speciesRouter.post("/admin/create", [verifyAccessToken, isAdmin], speciesController.adminCreateSpecies)
speciesRouter.put("/admin/edit", [verifyAccessToken, isAdmin], speciesController.adminEditSpecies)
speciesRouter.delete("/admin/delete/:speciesId", [verifyAccessToken, isAdmin], speciesController.adminDeleteSpecies)

module.exports = speciesRouter;
