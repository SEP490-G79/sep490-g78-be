const jwt = require("jsonwebtoken");

// het han trong 1 tieng
const accessTokenExp = 60*60*24;
//het han trong 7 ngay
const refreshTokenExp = 60 * 60 * 24 * 7;
// tao access token voi user id
const generateAccessToken = (userId) => {
    return jwt.sign({id: userId}, process.env.JWT_SECRET, {
        expiresIn: accessTokenExp, 
    });
}
// tao refresh token voi user id
const generateRefreshToken = (userId) => {
    return jwt.sign({id: userId}, process.env.REFRESH_JWT_SECRET, {
        expiresIn: refreshTokenExp, 
    });
}

// decode accessToken
const decode = (accessToken) => {
    return jwt.verify(accessToken, process.env.JWT_SECRET);
}

const jwtUtils = {
    accessTokenExp, refreshTokenExp,
    generateAccessToken,
    generateRefreshToken,
    decode,
}

module.exports = jwtUtils;
