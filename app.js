import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

import publicRoutes from "./src/routes/publicRoutes.js";

/**
 * Server configuration
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


/**
 * Setup Express Server
 */
const app = express();
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.set("view engine", "ejs");
app.set("views", path.join(currentDirectory, "./src/views"));
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(currentDirectory, "public")));

app.use("/", publicRoutes);

export default app;