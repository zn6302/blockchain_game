# syntax=docker/dockerfile:1

# 前端跟伺服器打包成同一個 image:同一個 process 既送網頁也開 WebSocket,
# 線上只需要一個網址、一個 port。詳見 README 的「部署」。
#
# 用 slim(Debian/glibc)而不是 alpine(musl):msgpackr 之類的套件有原生加速
# 模組,glibc 這邊比較不會出意外,代價只是 image 大一點。

ARG NODE_VERSION=22

# ---------- 1) 裝全部依賴,build 前端 ----------
FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /app
# 先只複製 manifest,讓 npm ci 這層能被 docker cache 住,
# 改 src 的時候不用重裝一次依賴。
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY react-app/package.json react-app/
COPY server/package.json server/
RUN npm ci
COPY shared/ shared/
COPY react-app/ react-app/
RUN npm run build

# ---------- 2) 只留 production 依賴 ----------
# 另外開一層裝,才不會把 vite/oxlint/playwright 這些 devDependencies
# 帶進最後的 image(playwright 特別大)。
FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY react-app/package.json react-app/
COPY server/package.json server/
RUN npm ci --omit=dev

# ---------- 3) 實際跑的 image ----------
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

# node_modules 裡的 @noxcat/shared 是指向 ../../shared 的 symlink,
# 所以下面的目錄結構要跟 repo 一樣,relative symlink 才解得開。
COPY --from=deps /app/node_modules node_modules
COPY package.json package-lock.json ./
COPY shared/ shared/
COPY server/ server/
# npm workspaces 需要這個 manifest 存在,但不需要 react-app 的原始碼。
COPY react-app/package.json react-app/
# server/src/index.js 預設會去找 ../../react-app/dist,位置對上就不用設 CLIENT_DIST。
COPY --from=builder /app/react-app/dist react-app/dist

EXPOSE 8080
USER node
CMD ["node", "server/src/index.js"]
