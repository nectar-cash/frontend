FROM node:lts AS builder

WORKDIR /app

COPY package.json .
RUN npm i

COPY . .

RUN npm run build

FROM nginx:alpine

WORKDIR /app

COPY --from=builder /app/dist /app

EXPOSE 8080
COPY ./nginx.conf /etc/nginx/nginx.conf
