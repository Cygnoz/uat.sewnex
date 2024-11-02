# Use an official Node.js runtime as a parent image
FROM node:22.11.0

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application code to the working directory
COPY . .

# Expose port 5003 for the application
EXPOSE 5003

# Command to run the application
CMD ["node", "server.js"]

