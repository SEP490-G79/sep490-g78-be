const adminMiddleware = require("./admin.middleware");
const authMiddleware = require("./auth.middleware");
const shelterMiddleware = require("./shelter.middleware");
const fileMiddleware = require("./file.middleware");

module.exports = {
    authMiddleware,
    adminMiddleware,
    shelterMiddleware,
    fileMiddleware,
}