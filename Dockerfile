FROM nikolaik/python-nodejs:python3.11-nodejs20

WORKDIR /app

# Copy and install Node dependencies
COPY backend/package.json backend/package-lock.json ./
RUN npm install

# Install Python dependencies (minimal)
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Create directories
RUN mkdir -p uploads reference_images

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

CMD ["node", "server.mjs"]
