import 'dotenv/config';
import app from './app.js';


const NODE_ENV = process.env.NODE_ENV?.toLowerCase() || 'production';
const PORT = process.env.PORT || 3000;

/**
 * Start WebSocket Server in Development Mode; used for live reloading
 */
if (NODE_ENV.includes('dev')) {
    const ws = await import('ws');

    try {
        const wsPort = parseInt(PORT) + 1;
        const wsServer = new ws.WebSocketServer({ port: wsPort });

        wsServer.on('listening', () => {
            console.log(`WebSocket server is running on port ${wsPort}`);
        });

        wsServer.on('error', (error) => {
            console.error('WebSocket server error:', error);
        });
    } catch (error) {
        console.error('Failed to start WebSocket server:', error);
    }
}

//app.set('trust proxy', NODE_ENV === 'production'); //('trust proxy', true);
app.set('trust proxy', 1); // trust first proxy so we can view it on render
// Start the server and listen on the specified port
app.listen(PORT, () => {
    console.log(NODE_ENV === 'production' ? 'Server is running in production mode.' : 'Server is running in development mode.');
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});