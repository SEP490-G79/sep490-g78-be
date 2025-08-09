const Redis = require("ioredis");

// cloud
const redisClient = new Redis(process.env.REDIS_CONNECTIONSTRING);
redisClient.on("connect", () => {
    console.log("Connected to Redis Cloud");
});

// local
// const redisClient = new Redis({
//     host: process.env.REDIS_HOST,
//     port: process.env.REDIS_PORT
// });
redisClient.on("connect", () => {
    console.log("Connected to Redis Local");
});


redisClient.on("error", (err) => {
    console.error("Error connecting to Redis", err);
});

module.exports = redisClient;
