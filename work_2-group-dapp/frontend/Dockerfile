# Production container for the SvelteKit frontend.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run check && npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV ORIGIN=http://blockfund.bahatijustin.dev

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/build ./build

EXPOSE 3000
CMD ["node", "build/index.js"]
