FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@10.26.1

COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY services ./services
COPY web ./web

RUN pnpm install --frozen-lockfile=false

ENV NODE_ENV=production
ENV MONGO_URI=mongodb://mongo:27017/?directConnection=true
ENV KAFKA_BROKERS=kafka:29092
ENV SIMULATOR_URL=http://simulator:4000

