
const socketIoConfig = require("../configs/socket-io.config");
const db = require("../models/index");
const authMiddleware = require("../middlewares/auth.middleware");
class SocketService {
  constructor() {
    this.io = null;
  }

  init() {
    if (this.io) {
      return;
    }
    this.io = socketIoConfig.getInstance();
    this.setupHandShake();
    this.setupEventHandlers();
  }
  
  setupHandShake() {
    this.io.engine.use((req, res, next) => {
        const isHandshakePhase = req._query.sid == undefined;
        if (isHandshakePhase) {
          authMiddleware.verifySocketAccessToken(req,res,next);
      } else {
        next()
      }
    });
  }

  setupEventHandlers() {
    if (!this.io) return;
    this.handleConnection();
    this.handleError();
  }

  handleConnection() {
    this.io.on("connection", async (socket) => {
      const { id } = socket.request.payload;
      // const userGroups = await GroupRepository.getGroupJoinedByUserId(user.id, [
      //   "id",
      // ]);
      const userShelter = await db.Shelter.findOne({
        "members._id": id
      });
      

      socket.join(`user:${id}`);
      // console.log("joined room:", `user:${id}`, socket.id);
      if(userShelter){
        socket.join(`shelter:${userShelter?._id}`);
      }
      // userGroups.forEach((group) => {
      //   socket.join(`group:${group.id}`);
      // });

      // if (!isProduction) {
      //   // logger.info(`${LOG_PREFIX} Connect ${user.id}`);
      //   console.log(`SocketIO connect ${id}`);
      //   socket.on("disconnect", (reason) => {
      //     // logger.info(`${LOG_PREFIX} Disconnect ${user.id}`);
      //     console.log(`SocketIO disconnect ${id}`);
      //   });
      // }
    });
  }

  handleError() {
    this.io.engine.on("connection_error", (err) => {
      const { message } = err;
      // logger.error(`${LOG_PREFIX} Connection error: ${message}`);
      console.log(`SocketIO Connection error:${message}`);
    });
  }

  getAllRooms() {
    return this.io.sockets.adapter.rooms;
  }

  getSocketConnection() {
    return this.io.sockets.sockets.size;
  }

  to(room, event, data) {
    if (!this.io) return;
    this.io.to(room).emit(event, data);
  }
}

module.exports = new SocketService();
