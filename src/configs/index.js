

const passport = require("../configs/passport.config");
const redisClient = require("./redisClient");
const mailer = require('./mailer.config');
const cloudinary = require('./cloudinary');
const SocketIO =require('./socket-io.config')
module.exports = {
    passport,
    redisClient,
    mailer,
    cloudinary,
    SocketIO
}