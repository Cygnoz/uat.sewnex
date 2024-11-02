# # Use an official Node.js runtime as a parent image
# FROM node:22.11.0

# # Set the working directory in the container
# WORKDIR /usr/src/app

# # Copy package.json and package-lock.json to the working directory
# COPY package*.json ./

# # Install dependencies
# RUN npm install --production

# # Copy the rest of the application code to the working directory
# COPY . .

# # Expose port 5003 for the application
# EXPOSE 5003

# # Command to run the application
# CMD ["node", "server.js"]




















# Use the official Node.js image as the base image
FROM node:lts-slim

# Create a non-root user for better security practices
RUN useradd -m appuser

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json with ownership set to appuser
COPY --chown=appuser:appuser package*.json ./

# Install the dependencies
RUN npm install --production --ignore-scripts

# Copy the rest of the application code to the working directory with ownership set to appuser
COPY --chown=appuser:appuser . .

# Switch to the non-root user
USER appuser

# Expose port 5001
EXPOSE 5003

# Command to run the application
CMD ["node", "server.js"]

