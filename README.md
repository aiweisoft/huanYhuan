# 缓一缓

> 匿名情绪树洞：写下来，抱一抱，不用急着好起来。

一个克制到近乎安静的情绪出口。没有粉丝、没有点赞、没有排行榜，也不诊断、不评分、不卖课。
发出去的树洞只能收到「抱一下」和几句预设的善意回应——把比较的入口全部关掉，
让「说出来」这件事本身变得便宜一点。

基于 uni-app（Vue 3）+ uniCloud 支付宝云，可编译为 Android App 与 H5。

---

## 它长什么样

四个 tab，对应四种「此刻需要的东西」：

| Tab | 做什么 |
|---|---|
| **树洞** | 写一条此刻的情绪，选一个标签（焦虑 / 低落 / 失眠 / 摩擦 / 社交 / 疲惫），匿名发出。别人的树洞可以「抱一下」，或留一句预设回应 |
| **读一点** | 心理科普内容库：分类、搜索、收藏、已读、字号调节、朗读。列表按更新时间倒序，卡片显示「更新于」和预计阅读时长。文章正文不做全文转载，保留原文链接 |
| **听一点** | 5 段自带白噪音（雨落在窗台 / 夜里的海 / 壁炉边 / 清晨的溪流 / 睡前十分钟），也可以从手机里添加自己的音频。播放中的列表项会呼吸高亮、图标跟着跳动；喇叭图标点开竖向音量条，点别处自动收起。全部只存在本机 |
| **我的** | 匿名昵称、我的树洞、收藏、数据导出与清空、求助资源、关于 |

另外两个贯穿全站的东西：

- **危机词识别**：正文命中自伤相关表达时，浮出求助卡片（12356 等热线可一键拨号），
  但**不阻断发布**。拦下来只会把人推走，给个出口更有用。
- **匿名优先**：不登录也能发帖。只有「抱一下 / 留一句 / 举报」需要登录，防刷。

## 最近更新（2026-11）

- **读一点**
  - 默认按 `updated_at` 倒序，卡片和详情页显示「更新于 2026-11-08」
  - 阅读时长从「3 分钟」改成「阅读约 3 分钟」，移到卡片右上角，避免被误读成「3 分钟前」
  - 新增「朗读」：调用系统 TTS 把标题和正文读出来，可随时停止，离开页面自动停
- **听一点**
  - 自带 5 段音频首次进入自动落地；复制失败会下次重试，开发基座退回 `_www`
  - 正在播放的列表项加呼吸高亮，前面的图标做跳动动画
  - 音量改成喇叭图标 + 竖向调节条，点页面其他地方自动收起，音量记忆在本机
- **内容抓取**
  - `tools/rss-import.mjs` 支持 `--json`、`--feeds`
  - 预计阅读时长改为中文约 150 字/分、英文约 200 词/分，向上取整
  - [`docs/04-内容抓取.md`](docs/04-内容抓取.md) 增加了 2026-11-08 的实跑记录和改写示例

## 设计基线

| 项 | 值 |
|---|---|
| 暖白 | `#F6F2EC` |
| 雾蓝 | `#3E5B69` |
| 陶土 | `#BE8567` |
| 夜间底色 | `#26211D` |

视觉上统一用一层「玻璃壳」：极光色块 + 半透明面板（透明度锁在 0.34–0.54），
`scroll-view` 内一律不用 `backdrop-filter`，保证低端机滚动不掉帧。
图标全是内联 SVG 描边，不引图标字体。规范见 [`docs/05-UI规范.md`](docs/05-UI规范.md)。

## 技术栈

- **客户端**：uni-app（Vue 3 语法）、自研 `glass-shell` 玻璃壳组件、`uni_modules/uni-id-pages` 负责登录注册
- **服务端**：uniCloud 支付宝云，单入口云对象 `huanhuan-co`
- **数据**：`huanhuan-posts` / `huanhuan-echoes` / `huanhuan-reports` / `huanhuan-articles`
- **身份**：uni-id（可选登录）+ 本机 `anonId`（匿名发帖）

四张业务表的 schema 权限全部为 `read/create/update/delete: false`，
客户端只能通过云对象读写——长度、敏感词、频率限制都在云对象里做。

## 目录结构

```
huanYhuan/
├─ pages/
│  ├─ index/        树洞列表（筛选、抱一下、发帖入口）
│  ├─ compose/      写下此刻（标签横向滚动 + 自定义标签 + 危机检测）
│  ├─ post/         单条树洞 + 回应
│  ├─ articles/     读一点（搜索、分类、收藏）
│  ├─ article/      文章详情
│  ├─ listen/       听一点（自带音频 + 本机音频 + 播放器）
│  ├─ mine/         我的
│  ├─ help/         求助资源
│  └─ about/        关于与免责声明
├─ components/      glass-shell / post-card / crisis-card / refreshBox
├─ common/
│  ├─ api.js        云对象统一入口
│  ├─ store.js      本地存储（身份、收藏、已读、设置）
│  ├─ articles.js   内容库读写
│  ├─ tts.js        朗读适配（Android / iOS / H5）
│  ├─ crisis.js     危机词识别
│  ├─ moods.js      情绪标签与预设回应
│  ├─ listen.js     本机音频 CRUD 与失效检测
│  ├─ player.js     单例播放器
│  ├─ file-picker.js / content-uri.js   选音频、复制到应用私有目录
│  └─ audio-library.js                  自带 5 段声音首次落地
├─ static/audio/    自带白噪音（首次进入时复制到 _doc/audio/）
├─ uniCloud-alipay/
│  ├─ cloudfunctions/huanhuan-co/       云对象
│  └─ database/                         集合 schema
├─ docs/            需求 / 设计 / 后端 / 内容抓取 / UI 规范 / 听一点改造
└─ tools/           RSS 抓取生成文章数据
```

## 本地跑起来

1. 用 HBuilderX 打开本目录。
2. **H5**：`运行 → 运行到浏览器`。
   **App**：`运行 → 运行到手机或模拟器`（用自己的基座或标准基座）。
3. 云端功能（发帖、抱一下、回应）需要先关联一个 uniCloud 支付宝云服务空间：
   - 右键 `uniCloud-alipay` → 关联云服务空间
   - 上传 `huanhuan-co`：右键云对象 → 上传部署
   - 初始化 `huanhuan-*` 集合：右键 `database` → 上传所有 DB Schema
4. 不联网也能跑通「读一点」和「听一点」；树洞列表会退化成只显示本地缓存。

> 登录页走 `uni_modules/uni-id-pages` 自带样式，需要在
> `uniCloud-alipay/cloudfunctions/common/uni-config-center/uni-id/config.json`
> 里补上 `passwordSecret` / `tokenSecret` 等配置后才可用。

## 打包 Android

需要自己的签名证书（`certs/` 已在 `.gitignore` 中排除，不会进仓库）：

```bash
cli pack --project <项目绝对路径> --platform android \
  --android.packagename com.huanhuan.treehole \
  --android.androidpacktype 0 \
  --android.certalias <别名> \
  --android.certfile <keystore 路径> \
  --android.certpassword <证书密码> \
  --android.storepassword <仓库密码> \
  --safemode false --ignoreWarnings true
```

只做编译检查时用 `cli publish h5 --project <路径>` 和
`cli publish app --type appResource --project <路径>`，两者都不消耗云打包次数。

## 隐私

- 不采集手机号、位置、通讯录；没有第三方统计 SDK
- 树洞内容存在云端，但 `user_id` / `anon_id` 只落库，不回传客户端
- 收藏、已读、昵称、听一点里的音频全部只在本机
- 音频导入时会复制一份到应用私有目录，移出只删副本，不动你手机里的原文件
- 「我的」里可以随时导出 JSON、清空全部数据

## 免责声明

本应用提供的是**情绪记录与心理科普**，不是心理咨询、诊断或治疗。
如果你正处在危险中，请立即联系当地急救或拨打心理援助热线（中国大陆：**12356**）。

## 文档

| 文件 | 内容 |
|---|---|
| [`docs/01-需求规格.md`](docs/01-需求规格.md) | 目标用户、范围、验收标准 |
| [`docs/02-设计说明.md`](docs/02-设计说明.md) | 信息架构、关键产品决策、数据模型 |
| [`docs/03-后端说明.md`](docs/03-后端说明.md) | 云对象接口、集合字段、校验与限流 |
| [`docs/04-内容抓取.md`](docs/04-内容抓取.md) | RSS 导入流程、阅读时长口径、实跑示例 |
| [`docs/05-UI规范.md`](docs/05-UI规范.md) | 玻璃态、颜色、间距、图标、文案 |
| [`docs/06-听一点改造方案.md`](docs/06-听一点改造方案.md) | 本机音频导入与播放链路、踩坑对照 |

## 许可

[Apache License 2.0](LICENSE)

登录、注册等模块来自 DCloud 的 [uni-starter](https://gitcode.net/dcloud/uni-starter)
与 `uni-id-pages`，遵循其各自许可。
