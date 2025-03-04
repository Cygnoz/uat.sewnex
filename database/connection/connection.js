const mongoose = require('mongoose')

const DB = process.env.DATABASE

mongoose.connect(DB)
.then(()=>{
    console.log("📡...Sewnex Database Connected Succesfully...📡");
}).catch((error)=>{
    console.log(`Database error ${error}`);
})







// const mongoose = require('mongoose');
// const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

// const secret_name = "billbizz_db";  // Replace with your secret name
// const region = "ap-south-1";  // Replace with your AWS region

// const client = new SecretsManagerClient({
//   region: region,
// });

// async function getMongoDbUri() {
//   let response;

//   try {
//     response = await client.send(
//       new GetSecretValueCommand({
//         SecretId: secret_name,
//         VersionStage: "AWSCURRENT",  // Use current version by default
//       })
//     );
//   } catch (error) {
//     console.error("Error fetching secret from Secrets Manager: ", error);
//     throw error;
//   }

//   const secret = JSON.parse(response.SecretString);
//   return secret.mongoUri;  // Ensure this matches how your MongoDB URI is stored
// }

// async function connectToDatabase() {
//   try {
//     const dbUri = await getMongoDbUri();  // Get MongoDB URI from Secrets Manager
    
//     await mongoose.connect(dbUri, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true
//     });
    
//     console.log("📡...BillBizz Database Connected Successfully...📡");
//   } catch (error) {
//     console.log(`Database connection error: ${error}`);
//   }
// }

// // Initialize database connection
// connectToDatabase();
