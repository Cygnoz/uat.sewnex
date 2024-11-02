# Use the official Node.js image as the base image
FROM node:lts-slim

# Create a non-root user for better security practices
RUN useradd -m appuser

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the dependencies
RUN npm install --production --ignore-scripts

# Copy the rest of the application code to the working directory
COPY . .

# Change ownership of the application files to the non-root user
RUN chown -R appuser:appuser /usr/src/app

# Switch to the non-root user
USER appuser

# Expose port 5001
EXPOSE 5001

# Command to run the application
CMD ["node", "server.js"]

