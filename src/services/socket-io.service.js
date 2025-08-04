const SocketIO = require("../configs/socket-io.config");

class SocketService {
  constructor() {
    this.io = null;
  }
}

module.exports = new SocketService();
