# MeetingRoom 会议室预定系统

基于 **uni-app + uniCloud（阿里云）** 的会议室预定系统，以微信小程序为主，同时支持 H5 / App 编译。

## 功能概览

- 会议室列表、占用状态与当日排队信息（占用中高亮、下一场预定）
- 预定申请、我的预定、预定详情（改期 / 取消 / 提前结束 / 延长会议）
- 管理员审批、用户管理、管理员免审批直通、代客预填申请
- uni-id 账号体系（注册、登录、重置密码、个人资料、实名认证）

## 目录结构

```
├─ pages/                 业务页面（登录、会议室、预定、审批、我的）
├─ components/            通用组件
├─ common/                工具与初始化逻辑（appInit 等）
├─ custom-tab-bar/        自定义 tabBar（按角色动态显示）
├─ static/                图片等静态资源
├─ uni_modules/           uni-app 插件（uni-id-pages 等）
├─ uniCloud-aliyun/       uniCloud 云函数 / 云对象（meeting-auth、meeting-room、meeting-admin）
├─ pages.json             页面路由与分包配置
├─ manifest.json          应用配置（appid、按需注入等）
├─ build&run.bat          一键编译与启动脚本
└─ server.js              极简静态服务器（H5 预览兜底用）
```

## 一键编译与启动

在项目根目录双击 **`build&run.bat`**（cmd 中文件名含 `&`，请写成 `"build&run.bat"`）。

前提：

- 已安装 **HBuilderX**（脚本自动探测 `D:\HBuilderX\cli.exe` 等常见路径；也可设环境变量 `HBX_CLI_PATH` 指向 cli.exe）
- H5 预览需要本机有 **python 或 node**（任一即可，脚本自动探测）

菜单说明：

| 选项 | 作用 | 产物目录 |
| --- | --- | --- |
| 1 | H5 发行编译 + 启动本地静态服务（服务器部署 / 浏览器访问） | `unpackage/dist/build/web` |
| 2 | 微信小程序 **发行**编译（上传体验版 / 正式版用） | `unpackage/dist/build/mp-weixin` |
| 3 | 微信小程序 **开发**编译（微信开发者工具预览用） | `unpackage/dist/dev/mp-weixin` |
| 4 | H5 开发模式运行（热更新） | 由 HBuilderX 内置服务托管 |

> 部署到公网服务器时，用 Nginx 托管 `unpackage/dist/build/web` 即可；
> 默认静态服务端口为 8080，可在脚本顶部 `set "PORT=8080"` 修改。

## 部署须知（微信小程序）

1. **服务器域名白名单**：小程序后台 → 开发 → 开发管理 → 开发设置 → 服务器域名，添加
   - request 合法域名：`https://api.next.bspapp.com`
   - socket 合法域名：`wss://api.next.bspapp.com`
   - uploadFile / downloadFile：`https://vkceyugu.cdn.bspapp.com`（用到文件上传时）
2. **小程序备案**：未完成 ICP 备案的小程序不会被微信搜索收录，且到期后将无法打开，
   需在公众平台「设置 → 基本设置 → 小程序备案」完成备案。
3. **体验版试用**：测试人员需先加入「管理 → 成员管理 → 体验成员」，再扫体验版二维码；
   正式发布后（提交审核 → 审核通过 → 手动点「发布」）任何人可搜索或扫码打开。
4. **云函数部署**：修改 `uniCloud-aliyun` 下的云对象后，需在 HBuilderX 中重新「上传部署」才生效。

---

## 附：uni-starter 模板原始说明

<h2>
文档已移至 <a href="https://uniapp.dcloud.io/uniCloud/uni-starter.html" target="_blank">uni-starter文档</a>
</h2>

## 常见问题

1. 报错 `Error: Invalid uni-id config file`

	创建并配置uni-id的配置文件，在目录	`uniCloud/cloudfunctions/common/uni-config-center/` 下新建 `uni-id/config.json` ， [参考文档云端配置config.json的说明完成配置](https://doc.dcloud.net.cn/uniCloud/uni-id/summary.html#config)

2. 报错 `onDBError {code: "SYSTEM_ERROR", message: "Config parameter missing, tokenSecret is required"}`

	在目录 `uniCloud/cloudfunctions/common/uni-config-center/uni-id/config.json` 中配置tokenSecret，参考文档[https://doc.dcloud.net.cn/uniCloud/uni-id/summary.html#config](https://doc.dcloud.net.cn/uniCloud/uni-id/summary.html#config)