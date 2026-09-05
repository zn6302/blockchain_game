# 區塊鏈大戰爭 — NOXCAT ARENA

四人對戰、單局三分鐘的加密幣即時戰略遊戲。**召喚貓咪 = 買幣，結算 = 賣幣**，錢就是血量：
資產歸零就出局，時間到時資產最多的人獲勝。

- 玩法說明 → [怎麼玩.md](怎麼玩.md)
- 設計與平衡細節 → [設計說明.md](設計說明.md)

## 這一局長什麼樣

| | |
|---|---|
| 幣種 | 只有 NOX，所有貓都綁它 |
| 目標格子 | 不用選，貓自己找路（礦工去人少的礦區、戰鬥兵去打第一名）|
| 戰鬥兵 | 前 60 秒鎖住，只能挖礦攢錢 |
| 礦區 | 三種礦都產 NOX，差別只有產量 $13/$9/$6 |

只有一種幣、不用選格子，是刻意的：少掉「押哪種幣」跟「派去哪一格」兩層決策，
玩家的注意力才會全部落在「召喚＝買、結算＝賣」這條主循環上。

---

## 快速開始

需要 Node 20 以上（開發用的是 24）。**`npm install` 要在專案根目錄跑**——這是
npm workspaces，一次會把 `shared/`、`react-app/`、`server/` 三個 package 都裝好；
跑進子資料夾裝會裝錯地方。專案沒有任何 `.env`，不用準備環境檔案。

```bash
npm install
npm run server     # 終端機 A：Colyseus 伺服器，預設 ws://localhost:2567
npm run dev        # 終端機 B：前端，開瀏覽器打開顯示的網址
```

兩個都要開著才能玩——遊戲的模擬跑在伺服器上，前端只負責顯示與送指令。

其他指令：`npm run build`（打包前端）、`npm run lint`。

### 多台裝置一起玩（同一個區網）

**只有一個人需要跑主機，其他人有瀏覽器就好，不用 clone。** 因為前端是用
「頁面是從哪台機器載入的」去推算伺服器位址，所以如果每個人都各自 `npm run dev`，
就會各自連到自己電腦上的伺服器，變成四場獨立的遊戲。

主機那個人改用 `dev:lan` 啟動前端（預設的 `npm run dev` 只綁 localhost，手機連不到）：

```bash
npm run server     # 會順便印出區網位址 ws://192.168.x.x:2567
npm run dev:lan    # 印出 http://192.168.x.x:5173
```

其他人連同一個 WiFi，瀏覽器打開那個 `http://192.168.x.x:5173` 就會看到進場畫面。
第一次啟動時作業系統可能會詢問是否允許傳入連線，兩個 node process 都要允許。

### 房號配對

進場畫面有三種進法：

| 進法 | 做什麼 |
|---|---|
| **建立房間** | 開一間新的，畫面上會給一組 4 位數房號，把號碼唸給朋友 |
| **輸入房號 → 加入** | 進到同一組號碼的那間房；號碼不存在／房間已滿／那場已開始都會當場告訴你 |
| **隨機配對** | 不指定房號，跟其他同樣按隨機配對的人湊一場 |

房號在選角色和大廳都看得到，點一下就複製。**沒有倒數自動開局**——
**只有開房間的人（房主）能按「開始遊戲」**，其他人看到的是「等房主開始…」；
空位補 bot，四個真人到齊時則自動開始。房主中途離開的話，房主會讓給還在房內的下一個人。
開局後房間會鎖起來，晚到的人不會被塞進打到一半的場。

---

## 專案結構

npm workspaces 三個 package：

```
shared/      client 與 server 共用的定義與平衡公式
react-app/   前端（Vite + React 19）
server/      Colyseus 多人伺服器
```

### 為什麼要有 `shared/`

手續費、礦區產出遞減、幣價換算戰力這些公式，前端要拿來顯示、後端要拿來結算。
兩邊各維護一份的話，只要有一邊改了就會算出不同的數字，畫面顯示的價格跟實際扣的錢對不上。
所以公式只有 `shared/src/derived.js` 這一份，兩邊都 import 它。

每個函式吃一個 `ctx = { S, COINS }`：`S` 是該局的可變狀態、`COINS` 是該局的幣價。
server 每個房間一份、client 每個分頁一份，彼此獨立不互相污染。

### 前端：命令式地圖引擎 + React 介面

地圖每幀要重畫上百個地塊、單位、特效，走 React 的 diff 會很浪費，
所以 `game/mapEngine.js` 自己直接操作 DOM/SVG；React 只負責周邊介面（HUD、部隊面板、操作列）。
兩者透過 `hooks/useEngineStore.js` 溝通。

### 後端：模擬與同步分離

`server/src/game.js` 是權威模擬，它的 `S`／`COINS` 刻意維持**一般的 plain JS 物件**，
跟單機版形狀一模一樣——因為 Colyseus 的 `MapSchema` 不支援 `COINS[k]` 這種寫法，
如果硬把 schema 實例塞進共用公式，就得把 `shared/` 整套改寫成 schema 語法，
或是再複製一份公式邏輯，兩者都違背上面「公式只有一份」的初衷。

改成每個 tick 由 `sync.js` 做一次單純的複製，把 plain state 寫進 schema state，職責就乾淨了：

```
game.js  只管模擬  →  sync.js  只管複製  →  ArenaRoom.js  只管房間與網路
```

`ArenaRoom` 固定四個座位，沒人的座位由 bot 頂替；玩家中途離線時座位立刻轉成 bot，
比賽不會卡住，並保留 20 秒讓他重連搶回來。

---

## 部署（一個網址就能玩）

線上版把**前端和伺服器包成同一個容器**：同一個 process 既送網頁也開 WebSocket，
對外只有一個網址、一個 port。朋友拿到的就是一條連結，不用另外設定伺服器位址。

會這樣選，是因為拆成「前端放 GitHub Pages ＋ 伺服器放別的地方」有幾個代價：
伺服器網址會被編進前端的 bundle（換位置就得重新 build 前端）、https 頁面連 `ws://`
會被瀏覽器當成 mixed content 擋掉、還要多管一組 CORS 跟 base path。同一個 origin 就都沒這些問題。

> **GitHub Pages 沒辦法單獨放這個遊戲。** Pages 只能放靜態檔，而 Colyseus 是一個
> 要一直活著、在記憶體裡拿著房間狀態的 Node process。GitHub Actions 負責「建置與部署」，
> 真正跑起來的地方要是能跑容器的平台。

### 需要先知道的一件事：只能跑一台

房號跟房間狀態都在單一 process 的記憶體裡（沒有接 Redis presence／driver）。
機器一旦不只一台，兩個人輸入同一個房號會被分到不同機器、永遠看不到對方。
所以 `fly.toml` 裡是 `auto_stop_machines = false` ＋ `min_machines_running = 1`，
部署後也要確認 `fly scale count 1`。這同時表示 Vercel／Netlify／Cloudflare Workers
這類 serverless 平台都不能用。

四人一房、20 Hz 同步，一台小機器同時開幾十間房是夠的。

### 相關檔案

| 檔案 | 做什麼 |
|---|---|
| `Dockerfile` | 三段式：build 前端 → 只裝 production 依賴 → 兜成最後的 image |
| `.dockerignore` | 不要把 `node_modules`、`.git` 這些送進 build context |
| `fly.toml` | Fly.io 設定（port、健康檢查、固定一台機器）|
| `.github/workflows/ci.yml` | PR 與 main 上跑 lint ＋ build |
| `.github/workflows/deploy.yml` | push 到 main 就自動部署 |
| `.nvmrc` | 釘住 Node 版本，CI 跟線上一致 |

### 先在本機確認（不用先開機器）

```bash
npm run preview:prod      # build 前端，然後用 production 模式起伺服器
```

打開 `http://localhost:2567`：**網頁、WebSocket、房號配對全部走這一個 port**。
開兩個分頁，一個建立房間、一個輸入同樣的房號加入，看得到對方就代表打包方式是對的。
（如果 2567 已經被 `npm run server` 佔著，先把它關掉，或用 `PORT=3000 npm run start`。）

### 部署到 Fly.io

```bash
    # 建 app（fly.toml 的 app 名字要全球唯一，會請你改）
flyctl deploy                # 第一次手動部署，確認真的起得來
flyctl scale count 1         # 確認只有一台
```

接著把 `FLY_API_TOKEN`（用 `flyctl tokens create deploy` 產生）加到 GitHub repo 的
Actions secrets，之後 push 到 `main` 就會自動部署。

Railway、Render 也可以，都是吃同一份 `Dockerfile`。只要注意 **Render 免費方案會休眠**：
閒置後第一個連線要等約 50 秒，配對請求會直接逾時，玩家看到的是「連線失敗」。

### 部署後一定要做的確認

用**兩台不同網路的裝置**（不是同一台開兩個分頁）測一次：一個建房唸房號、另一個加入。
這是本機測不出來的部分——`wss://` 能不能穿過平台的反向代理，只有真的部署上去才知道。

---

## 目前進度

| 部分 | 狀態 |
|---|---|
| `shared/` 公式抽取 | ✅ 完成 |
| Colyseus 伺服器（房間、大廳、模擬、同步、斷線接手） | ✅ 完成 |
| 前端接上伺服器（房號配對） | ✅ 完成 |
| 單一容器打包（前端與伺服器同一個 origin） | ✅ 完成，本機驗證通過 |
| 實際部署到公開網址 | ⬜ 待第一次 `flyctl deploy` |
