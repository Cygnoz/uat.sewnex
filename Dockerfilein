# Use the official Node.js image as the base image
FROM node:lts-slim

# Create a non-root user for better security
RUN useradd --create-home appuser

# Set the working directory inside the container
WORKDIR /home/appuser/app

# Copy package files first for more efficient caching of dependencies
COPY --chown=appuser:appuser package*.json ./

# Install dependencies with production flag and no scripts for security
RUN npm install --production --ignore-scripts && npm cache clean --force

# Copy the rest of the application files with ownership
COPY --chown=appuser:appuser . .

# Change permissions to remove write access for certain files
RUN find . -type f -executable -exec chmod a-w {} \;

# Remove temporary or sensitive files if needed
RUN rm -f ./dependency-check-report.html || true

# Ensure only the non-root user runs the container
USER appuser

# Expose the necessary port
EXPOSE 5003

# Start the application
CMD ["node", "server.js"]
