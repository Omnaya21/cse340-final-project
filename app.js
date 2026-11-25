import 'dotenv/config';
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { sessionMiddleware } from "./src/middleware/session.js";
import {issueCsrfToken } from "./src/middleware/csrf.js";
import { loadCurrentUser } from "./src/middleware/currentUser.js";
//import session from "express-session";
import authRoutes from "./src/routes/authRoutes.js";
import publicRoutes from "./src/routes/publicRoutes.js";
import connectPgSimple from "connect-pg-simple";


// Import MVC components
import { addLocalVariables } from './src/middleware/global.js';



/**
 * Server configuration
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


/**
 * Setup Express Server
 */
const app = express();
const currentDirectory = __dirname;

app.use(sessionMiddleware);
app.use(issueCsrfToken);
app.use(loadCurrentUser);
/*
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
*/

app.use(express.static(path.join(__dirname, 'public')));
app.set("view engine", "ejs");
app.set("views", path.join(currentDirectory, "/src/views"));
console.log(`Views directory set to: ${app.get("views")}`);
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Global middleware (sets res.locals variables)
app.use(addLocalVariables);

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(currentDirectory, "public")));

app.use("/", publicRoutes);
app.use("/auth", authRoutes);

/**
 * Error Handling
 */

// 404 handler
app.use((req, res, next) => {
    const err = new Error('Page Not Found');
    err.status = 404;
    next(err);
});

// Global error handler
app.use((err, req, res, next) => {
    // Prevent infinite loops, if a response has already been sent, do nothing
    if (res.headersSent || res.finished) {
        return next(err);
    }

    // Determine status and template
    const status = err.status || 500;
    const template = status === 404 ? '404' : '500';
    const NODE_ENV = process.env.NODE_ENV;
    // Prepare data for the template
    const context = {
        title: status === 404 ? 'Page Not Found' : 'Server Error',
        error: NODE_ENV === 'production' ? 'An error occurred' : err.message,
        stack: NODE_ENV === 'production' ? null : err.stack,
        NODE_ENV // Our WebSocket check needs this and its convenient to pass along
    };

    // Render the appropriate error template with fallback
    try {
        res.status(status).render(`errors/${template}`, context);
    } catch (renderErr) {
        // If rendering fails, send a simple error page instead
        if (!res.headersSent) {
            res.status(status).send(`<h1>Error ${status}</h1><p>An error occurred.</p>`);
        }
    }
});

export default app;