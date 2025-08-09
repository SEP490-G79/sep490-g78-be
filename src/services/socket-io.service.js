const SocketIO = require("../configs/socket-io.config");

class SocketService {
  constructor() {
    this.io = null;
  }

  init(){
    if(this.io) {
      return;
    }
    this.io =SocketIO.getInstance();
    this.setupHandShake();
    this.setupEventHandlers();
  }
  
}

module.exports = new SocketService();
