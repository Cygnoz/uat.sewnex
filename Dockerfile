# Use the official Node.js image from the Docker Hub
FROM node:22.11.0

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install application dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port your application will run on
EXPOSE 4005

# Define the command to run your application
CMD [ "node", "server.js" ]