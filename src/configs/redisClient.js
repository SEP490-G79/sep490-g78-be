const Redis = require("ioredis");

// cloud
const redisClient = new Redis(process.env.REDIS_CONNECTIONSTRING);
redisClient.on("connect", () => {
    console.log("Kết nối thành công đến Redis Cloud");
});

// local
// const redisClient = new Redis({
//     host: process.env.REDIS_HOST,
//     port: process.env.REDIS_PORT
// });
redisClient.on("connect", () => {
    console.log("Kết nối thành công đến Redis Local");
});


redisClient.on("error", (err) => {
    console.error("Lỗi kết nối Redis", err);
});

module.exports = redisClient;
