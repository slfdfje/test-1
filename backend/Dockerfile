# Use Python base with Node.js for AI matching
FROM python:3.11-slim

# Install Node.js
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (for caching)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Node dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy app files
COPY . .

# Create directories
RUN mkdir -p uploads reference_images

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "server.mjs"]
