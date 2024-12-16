require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const server = express();

const inventoryRouter = require("./router/inventoryRouter");
require('./database/connection/connection');

// Define allowed origins
const allowedOrigins = [
    'https://dev.billbizz.cloud', 
    'http://localhost:5173',  
    'http://localhost:5174'
]; 

// CORS configuration
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, origin);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'], 
    allowedHeaders: ['Content-Type', 'Authorization'], 
    credentials: true, 
};

// Middleware setup
server.use(helmet());  // Security headers
server.use(cors());  // CORS with options
server.use(express.json({ limit: '10mb' })); // Set limit for JSON payloads
server.use(express.urlencoded({ limit: '10mb', extended: true })); // Set limit for URL-encoded payloads
server.use(inventoryRouter); // Route definitions

const PORT = 5003

server.get('/',(req,res)=>{
    res.status(200).json("Dev Bill BIZZ server started - Inventory ")
});

server.listen(PORT,()=>{
    console.log(`BillBIZZ server Inventory started at port : ${PORT}`);
});

