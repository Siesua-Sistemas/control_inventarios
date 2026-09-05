FROM node:20-alpine

ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

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

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "./node_modules/next/dist/bin/next", "start"]
