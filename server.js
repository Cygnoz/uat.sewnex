require('dotenv').config();

const express = require('express');
const cors = require('cors');

const server = express();



// Increase the limit for JSON payloads
server.use(express.json({ limit: '10mb' })); // Set limit to 10MB

// Increase the limit for URL-encoded payloads
server.use(express.urlencoded({ limit: '10mb', extended: true }));




// Import routers
const organizationRouter = require('./router/organizationRouter');


require('./database/connection/connection');

// Middleware setup
server.use(cors());

server.use(express.json());

// Routes setup
server.use(organizationRouter);


const PORT = process.env.PORT || 5004;

server.get('/', (req, res) => {
    res.status(200).json("Dev Bill BIZZ server started - Organization(v.1.0)");
});

server.listen(PORT, () => {
    console.log(`BillBIZZ server Organization started at port : ${PORT}`);
});
