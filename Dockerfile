# Use an official Node.js runtime as a parent image
FROM node:22.11.0

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files to the working directory
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port the app runs on
EXPOSE 5002

# Define the command to run your application
CMD [ "node", "server.js" ]

