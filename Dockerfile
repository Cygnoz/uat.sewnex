# Use an official Node.js runtime as a parent image
FROM node:22.11.0

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose port 5007 to the outside world
EXPOSE 5007

# Define the command to run your application
CMD ["node", "server.js"]

