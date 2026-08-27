# 回声画廊 · echo gallery

个人摄影作品的策展式画廊：[echogallery.art](https://echogallery.art)

用 [Astro](https://astro.build) 服务端渲染，整站跑在 Cloudflare Workers 上——
内容存 D1 数据库，照片存 R2，后台自带登录。**不依赖任何外部账号或令牌**，
后台改动即时生效，不需要等待构建部署。

## 架构

| 层 | 用的什么 |
| --- | --- |
| 网站 | Astro SSR on Cloudflare Workers |
| 数据 | D1（`virtual-gallery`，APAC 区域） |
| 图片 | R2（`virtual-gallery-photos`），经 `/photo/<key>` 提供 |
| 会话 | KV（`virtual-gallery-sessions`） |
| 域名 | `echogallery.art`，由 Cloudflare 直接代理到 Worker |

照片放在自己域名下而不是第三方图床，是为了让访客只需要能连通一个域名——
这对网络受限地区的访问是有意义的。

## 本地开发

```sh
npm install
npm run dev
```

`platformProxy` 会让本地开发拿到和线上一样的 D1 / R2 / KV 绑定，
数据落在 wrangler 自己的本地 SQLite 里，不会碰到线上数据。

首次需要先建本地表：

```sh
npx wrangler d1 execute virtual-gallery --local --file=db/schema.sql
```

## 部署

```sh
npx astro build
npx wrangler deploy --config dist/server/wrangler.json
```

用适配器生成的那份配置部署，而不是根目录的 `wrangler.toml`：`main` 指向的入口文件
要等构建才生成，写在根配置里会让构建本身失败，所以交给适配器生成。

## 项目结构

```
db/schema.sql              数据库结构
scripts/migrate-to-d1.mjs  当年把 JSON 数据搬进 D1 的脚本（保留作记录）
src/
├── lib/
│   ├── types.ts       Photo / Series 等共享类型
│   ├── db.ts          D1 查询与绑定获取
│   ├── auth.ts        口令哈希与会话签名
│   └── api.ts         API 通用响应工具
├── middleware.ts      服务端拦截 /admin 与 /api/admin
├── components/        PhotoGrid / FlowViewer / Lightbox / CuratingCurtain …
└── pages/
    ├── index.astro          首页（最新三个系列）
    ├── gallery/             系列列表与详情
    ├── photo/[key].ts       从 R2 提供图片
    ├── api/auth/            登录、登出、状态
    ├── api/admin/           照片与系列的增删改、上传
    └── admin/               后台四个页面 + 登录页
```

## 后台

`/admin/`，四个页面：上传照片、照片管理、系列管理、自由排版。

**登录**：首次访问会让你设置口令。口令经 PBKDF2 加盐哈希存在 D1 里，
登录状态是服务端签发的 HttpOnly Cookie——所以**任何浏览器、任何设备都是同一份**。

> Workers 限制 PBKDF2 最多 10 万次迭代，而本地开发环境不执行这个限制。
> 调整 `PBKDF2_ITERATIONS` 时注意：超过上限只会在部署后才报错。

`/admin` 和 `/api/admin` 都由 `src/middleware.ts` 在服务端拦截，
未登录的请求根本到不了页面或写接口。

## 画廊功能

**五种排版**，每个系列单独选择：

| 排版 | 效果 |
| --- | --- |
| `grid` | 均匀网格，统一裁切比例 |
| `masonry` | 瀑布流，保留原始比例 |
| `editorial` | 杂志式大小交错 |
| `freeform` | 自由拖拽摆放（手机上自动改为竖向堆叠） |
| `flow` | 沉浸式逐张浏览，可选横向或纵向 |

**展厅灯光**：`flow` 页面右上角的开关。打开后整页变暗成灰调展厅，
照片亮起一圈与主题色呼应的轮廓光。

**策展中 / 已发布**：未发布的系列显示「策展中，敬请期待」的幕布，照片不外露。
新建系列默认未发布。

**主题色与背景**：每个系列可设核心色彩，页面背景可跟随网站默认、
用主题色淡淡渲染，或完全自定义。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地开发服务器 |
| `npm run build` | 构建 |
| `npx wrangler deploy --config dist/server/wrangler.json` | 部署 |
| `npx wrangler tail virtual-gallery` | 查看线上实时日志 |
