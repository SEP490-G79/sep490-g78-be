const morgan = require("morgan");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const MongoStore = require('connect-mongo');

require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const passport = require("./configs/passport.config");

const {
  userRouter,
  petRouter,
  authRouter,
  medicalRecordRouter,
  adoptionSubmissionRouter,
  shelterRouter,
  adoptionTemplateRouter,
  speciesRouter,
  breedRouter,
  adoptionFormRouter,
  postRouter,
  donationRouter,
  reportRouter,
  blogRouter,
  notificationRouter,
  returnRequestRouter,
  consentFormRouter,
} = require("./routes");

const path = require("path");
const http = require("http");
const db = require("./models");
const app = express();
const session = require("express-session");
const { createServer } = require("http");
const { SocketIO } = require("./configs");
const socketIoService = require("./services/socket-io.service");
const server = createServer(app);

// Sử dụng cors middleware để cho phép request từ localhost:3000
app.use(
  cors({
    origin: [
      process.env.FE_URL_USER || "http://localhost:5173",
      process.env.FE_URL_ADMIN || "http://localhost:6456",
    ],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  })
);  
app.use(express.json({ limit: "5mb" }));
if (process.env.NODE_ENV == "development") {
  app.use(morgan("dev"));
}

app.use(bodyParser.json({ limit: "5mb" }));
app.use(cookieParser());
// passport oauth
app.use(
  session({
    secret: process.env.SESSION_SECRET || "pawShelterBESystemSession123987",
    resave: false,
    saveUninitialized: false,
    store: process.env.NODE_ENV === "production" ?  MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      ttl: 7 * 24 * 60 * 60,  // Session 7 ngày
    }) : undefined,
    cookie: {
      secure: process.env.NODE_ENV === "production", // true khi production
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // cần thiết nếu frontend và backend khác domain
    }
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get("/", async (req, res, next) => {
  res.status(200).json({ message: "Server đang chạy" });
});

// Định tuyến theo các chức năng thực tế
app.use("/pets", petRouter);
app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/shelters", shelterRouter);
app.use("/adoption-submissions", adoptionSubmissionRouter);
app.use("/pets/:petId/medical-records", medicalRecordRouter);
app.use("/pets/:petId/adoption-submissions", adoptionSubmissionRouter);
app.use("/shelters/:shelterId/adoptionForms", adoptionFormRouter);
app.use("/shelters/:shelterId/adoptionTemplates", adoptionTemplateRouter);
app.use("/consentForms", consentFormRouter);
app.use("/species", speciesRouter);
app.use("/breeds", breedRouter);
app.use("/posts", postRouter);
app.use("/donations", donationRouter);
app.use("/reports", reportRouter);
app.use("/blogs", blogRouter);
app.use("/notifications", notificationRouter);
app.use("/return-requests", returnRequestRouter);
// app.use("/posts/:postId/comments", );
// app.use("/notifications", );
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));


app.use((err, req, res, next) => {
  if (res.headersSent) return next(err); // tránh gửi error nhiều lần
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Lỗi server!";
  // Log debug ở be
  console.error({
    name: err.name,
    message: err.message,
    status,
    method: req.method,
    url: req.originalUrl,
    stack: err.stack,
  });

  res.status(status).json({
    status,
    message
  });
});

SocketIO.init(server); 
socketIoService.init();

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`Server đang chạy tại port: ${port}`);
  db.connectDB();
});
