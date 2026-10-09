FROM node:24.21.0-bookworm-slim
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
EXPOSE 3001
CMD ["npm", "run", "start", "--workspace=@dndharness/api"]
