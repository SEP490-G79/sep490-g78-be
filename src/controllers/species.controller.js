const Species = require("../models/species.model");
const speciesService = require("../services/species.service");

const getAllSpecies = async (req, res) => {
  try {
    const species = await Species.find();

    res.status(200).json(species);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createSpecies = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });
    // Kiểm tra trùng tên
    const existed = await Species.findOne({ name });
    if (existed)
      return res.status(409).json({ message: "Species already exists" });
    const species = new Species({ name });
    await species.save();
    res.status(201).json(species);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const getAll = async (req, res) => {
  try {
    const species = await Species.find();
    res.status(200).json(species);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


//ADMIN
const adminGetAll = async (req, res) => {
  try {
    const species = await speciesService.getAll();
    res.status(200).json(species);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const adminCreateSpecies = async (req, res) => {
  try {
    const {name, description} = req.body;
    const response = await speciesService.createSpecies(req.payload.id, name, description);
    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const adminEditSpecies = async (req, res) => {
  try {
    const {speciesId, description} = req.body;
    const response = await speciesService.editSpecies(req.payload.id, speciesId, description);
    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const adminDeleteSpecies = async (req, res) => {
  try {
    const {speciesId} = req.params;
    const response = await speciesService.deleteSpecies(req.payload.id, speciesId);
    res.status(200).json(response);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const speciesController = {
  getAllSpecies,
  createSpecies,
  getAll,

  //ADMIN
  adminGetAll,
  adminCreateSpecies,
  adminEditSpecies,
  adminDeleteSpecies,
};
module.exports = speciesController;

