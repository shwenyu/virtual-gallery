# 回声画廊 · Virtual Gallery

个人摄影作品的策展式画廊。用 [Astro](https://astro.build) 构建，托管在 GitHub Pages，
照片存放在 Cloudinary（免费额度，自动做分辨率与色彩优化），上传通过一个仅站主本人使用的
`/admin` 后台页面完成——没有任何自建服务器。

## 项目结构

```
src/
├── data/
│   ├── photos.json     照片清单（id / 图片地址 / 尺寸 / 说明 / 标签）
│   └── series.json     系列（策展分组）：标题、排版风格、照片顺序
├── lib/content.ts       读取上面两份数据的工具函数
├── layouts/BaseLayout.astro
├── components/
│   ├── PhotoGrid.astro  三种排版：grid / masonry / editorial
│   └── Lightbox.astro   点击放大查看
└── pages/
    ├── index.astro       首页
    ├── gallery/index.astro     系列列表
    ├── gallery/[slug].astro    单个系列详情页
    ├── about.astro
    └── admin/index.astro       上传后台（不出现在导航栏中）
```

## 本地开发

```sh
npm install
npm run dev
```

打开 http://localhost:4321

## 部署到 GitHub Pages

1. 在 GitHub 新建一个仓库（例如 `virtual-gallery`），把这个项目推送上去。
2. 仓库 Settings → Pages → Source 选择 **GitHub Actions**（`.github/workflows/deploy.yml` 已经配置好了自动构建部署，推送到 `main` 分支即会触发）。
3. `astro.config.mjs` 里的 `site`/`base` 会在 Actions 构建时根据仓库名自动推导，本地开发不受影响，无需手动改动。

## 配置照片上传后台（`/admin`）

这个页面不出现在导航栏里，只有知道地址的人（也就是你自己）会访问到。它本身不包含任何密钥——
你在自己的浏览器里填入以下信息，只保存在你本机的 `localStorage`，不会打包进网站代码。

### 1. Cloudinary（图床，免费额度）

1. 注册 https://cloudinary.com/users/register/free
2. 控制台首页可以看到 **Cloud Name**，记下来。
3. Settings → Upload → Upload presets → Add upload preset：
   - Signing Mode 选 **Unsigned**
   - 记下这个 preset 的名字
4. （可选，色彩管理）在该 upload preset 里可以设置默认的 `f_auto,q_auto` 传输参数；后台代码在上传后也会自动在图片地址里加上 `f_auto,q_auto`，保证浏览器按需获取合适分辨率与格式的版本。

### 2. GitHub Token

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token
2. Repository access 选择 **只勾选这一个仓库**
3. Permissions 里只给 **Contents: Read and write**（不需要其他权限）
4. 生成后复制保存好（离开页面后无法再次查看）

### 3. 在 `/admin` 页面填写

打开 `https://<你的用户名>.github.io/virtual-gallery/admin/`，展开「连接设置」，填入：

- Cloudinary Cloud Name / Upload Preset
- GitHub Owner（你的用户名）/ Repo / 分支（默认 `main`）/ Token

点击「保存到本机」。之后就可以选图片、选择或新建系列、填写说明和标签，点击「上传并提交到仓库」——
它会：上传图片到 Cloudinary → 把新照片信息写入 `src/data/photos.json` → 更新对应系列的
`src/data/series.json`（如指定了系列）→ 提交这两次 commit。GitHub Actions 会自动重新构建，
一两分钟后网站上就能看到新照片。

> 安全提示：不要在公共/共享电脑上使用这个后台；用完可以随时在 GitHub 设置里吊销该 token。

## 调整画廊编排

- 系列的呈现顺序、标题、描述、排版风格（`grid` / `masonry` / `editorial`）都在
  `src/data/series.json` 里，可以直接编辑或通过后台调整。
- 一张照片可以出现在多个系列里，只要把它的 `id` 加进对应系列的 `photoIds`。
- 想要新的排版节奏，可以在 `src/components/PhotoGrid.astro` 里加新的 CSS 变体。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地开发服务器 |
| `npm run build` | 构建到 `./dist/` |
| `npm run preview` | 本地预览构建产物 |
