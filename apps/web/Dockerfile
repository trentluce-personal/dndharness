FROM node:24.21.0-bookworm-slim

WORKDIR /workspace

# Use the monorepo's single lockfile. Bind-mounted source is provided by Compose.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace=@dndharness/web", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
