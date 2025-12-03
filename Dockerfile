FROM nikolaik/python-nodejs:latest

WORKDIR /app

# Copy and install Node dependencies
COPY backend/package*.json ./
RUN npm install

# Copy and install Python dependencies (CPU-only PyTorch)
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/*.mjs backend/*.py backend/*.json ./

# Create necessary directories
RUN mkdir -p uploads reference_images

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

CMD ["node", "server.mjs"]
