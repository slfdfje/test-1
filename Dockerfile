FROM nikolaik/python-nodejs:latest

WORKDIR /app

# Copy backend package files first for better caching
COPY backend/package*.json ./
RUN npm install

# Copy Python requirements and install (no cache to save space)
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend application
COPY backend/ .

# Create necessary directories
RUN mkdir -p uploads reference_images

# Expose port
EXPOSE 5000

# Set environment variables
ENV PORT=5000
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# Start the server
CMD ["node", "server.mjs"]
