import mongoose from 'mongoose';

// Ensure that environment variables are loaded
const DB: string | undefined = process.env.DATABASE;

if (!DB) {
    console.error("❌ Database connection string is missing in environment variables");
    process.exit(1); // Exit the process if the DATABASE environment variable is not set
}

mongoose.connect(DB)
    .then(() => {
        console.log("📡...BillBizz Database Connected Successfully...📡");
    })
    .catch((error: Error) => {
        console.error(`Database error: ${error.message}`);
    });