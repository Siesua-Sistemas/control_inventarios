FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cache-friendly)
COPY package*.json ./
RUN npm ci --production=false

# Copy app files and ensure node can access installed binaries
COPY --chown=node:node . ./

# Ensure local binaries are executable (prevents 'next: Permission denied')
RUN chmod -R a+x ./node_modules/.bin || true

# Give ownership of the app directory to the node user so builds can run as non-root
RUN chown -R node:node /app || true

# Run build as non-root user
USER node
RUN npm run build

EXPOSE 3000

CMD ["node", "./node_modules/next/dist/bin/next", "start"]
