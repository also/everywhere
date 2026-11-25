# syntax=docker/dockerfile:1
# Runs the tools in tools/ (api-server, build-* etc.). Mount your data
# directory at /everywhere/data. The working directory is the app, as before.
#
#   docker run -v /path/to/data:/everywhere/data ghcr.io/also/everywhere api-server --host 0.0.0.0
#   docker run -v /path/to/data:/everywhere/data ghcr.io/also/everywhere build-combined-strava-dataset

ARG NODE_VERSION=22.11.0

FROM node:${NODE_VERSION} AS build
# corepack in node 22.11 has an outdated signing key, so install pnpm directly
RUN npm install -g pnpm@9.12.3
WORKDIR /everywhere/app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .

FROM node:${NODE_VERSION}-slim
ENV NODE_ENV=production \
    EVERYWHERE_DATA_DIR=/everywhere/data \
    EVERYWHERE_CREDS_DIR=/everywhere/data/creds
COPY --from=build /everywhere/app /everywhere/app
WORKDIR /everywhere/app
EXPOSE 3001
ENTRYPOINT ["node", "/everywhere/app/tools"]
CMD ["api-server", "--host", "0.0.0.0"]
