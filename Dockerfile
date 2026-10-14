# syntax=docker/dockerfile:1

# Pinned base image (Constitution Principle XI: reproducible images).
ARG NODE_IMAGE=node:22.20.0-alpine3.22

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/api-contract/package.json packages/api-contract/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY e2e/package.json e2e/
RUN npm ci --ignore-scripts

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/api-contract packages/api-contract
COPY backend backend
COPY frontend frontend
RUN npm run generate:api-types \
  && npm run build -w frontend \
  && npm run build -w backend

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    CONTRACT_PATH=/app/packages/api-contract/openapi.yaml \
    STATIC_DIR=/app/frontend/dist
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/api-contract/package.json packages/api-contract/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY e2e/package.json e2e/
RUN npm ci --omit=dev -w backend --ignore-scripts && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
COPY backend/migrations backend/migrations
COPY packages/api-contract/openapi.yaml packages/api-contract/openapi.yaml
COPY --from=build /app/frontend/dist frontend/dist
USER node
EXPOSE 3000
CMD ["node", "backend/dist/server.js"]
