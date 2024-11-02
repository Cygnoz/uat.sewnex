# Use the official Node.js image as the base image
FROM node:22.11.0

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the dependencies
RUN npm install --production

# Install aws-sdk to interact with AWS services (optional if not in package.json)
RUN npm install aws-sdk

# Copy the rest of the application code to the working directory
COPY . .

# Expose port 5001
EXPOSE 5001

# Command to run the application
CMD ["node", "server.js"]

