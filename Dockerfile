FROM node:24-slim

WORKDIR /app

# 先裝套件，沒改 package.json 就會吃快取
COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 8000
CMD ["npm", "start"]
