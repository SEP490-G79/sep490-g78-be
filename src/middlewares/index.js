const adminMiddleware = require("./admin.middleware");
const authMiddleware = require("./auth.middleware");
const shelterMiddleware = require("./shelter.middleware");

module.exports = {
    authMiddleware,
    adminMiddleware,
    shelterMiddleware,
}