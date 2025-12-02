FROM nikolaik/python-nodejs:latest

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install

# Copy Python requirements and install
COPY requirements.txt ./
RUN pip install -r requirements.txt

# Copy the rest of the application
COPY . .

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
