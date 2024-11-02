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

# Install npm-check-updates globally
RUN npm install -g npm-check-updates --ignore-scripts

# Update packages using ncu
RUN ncu -u

# Install any new dependencies
RUN npm install

# Copy the rest of the application code to the working directory with ownership set to appuser
COPY --chown=appuser:appuser . .

# Remove the dependency-check-report.html file if it exists
RUN rm -f dependency-check-report.html

# Remove write permissions for the app user on the server.js file
RUN chmod -w server.js

# Switch to the non-root user
USER appuser

# Expose port 5001
EXPOSE 5003

# Command to run the application
CMD ["node", "server.js"]
