import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import customerRouter from './routes/customerRoute'; 
import './config/dbConfig';

const server = express();
server.use(cors());
server.use(helmet());
server.use(express.json());

server.use(customerRouter);

const PORT = 5002;

server.get('/', (_, res) => {
    res.status(200).json("Bill BIZZ server started - Customer");
});

// Global error handling middleware
server.use((err: any, _: Request, res: Response, __: NextFunction) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error'
        }
    });
});


const app = server.listen(PORT, () => {
    console.log(`BillBIZZ server Customer started at port : ${PORT}`);
});

export default app;
