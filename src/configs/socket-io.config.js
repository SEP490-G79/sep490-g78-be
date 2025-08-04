const { Server } = require("socket.io");

const SOCKET_CONFIG = {
  path: "/socket",
  cors: {
    origin: process.env.FE_URL_USER,
    credentials: true,
  },
};

class SocketIO {
  constructor() {
    this.instance = null;
  }
  init(server) {
    if (!this.instance) {
      this.instance = new Server(server, SOCKET_CONFIG);
      console.log(`Connected to socketIO!`);
    } else {
      throw new Error("Already initialized!");
    }
  }
  getInstance() {
    if (this.instance) return this.instance;
    console.error("Instance not initialized!");
  }
}

module.exports = new SocketIO();

