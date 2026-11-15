import app from './app.js';

const NODE_ENV = process.env.NODE_ENV?.toLowerCase() || 'production';
const PORT = process.env.PORT || 3000;

// Start the server and listen on the specified port
app.listen(PORT, () => {
    console.log(NODE_ENV === 'production' ? 'Server is running in production mode.' : 'Server is running in development mode.');
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});