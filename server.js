import 'dotenv/config';
import app from './app.js';

const NODE_ENV = process.env.NODE_ENV || 'production';
// Define the port number the server will listen on
const PORT = process.env.PORT || 3000;

// Start the server and listen on the specified port
app.listen(PORT, () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});