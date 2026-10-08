# 会议室预定系统 - 数据库初始化说明

## 初始化步骤

### 1. 上传 Schema
在 HBuilderX 中，右键点击以下 schema 文件，选择"上传 DB Schema"：
- `uniCloud-aliyun/database/meeting-rooms.schema.json`
- `uniCloud-aliyun/database/meeting-bookings.schema.json`

### 2. 初始化房间数据

#### 方式一：通过 HBuilderX 控制台
1. 打开 HBuilderX，右键点击 `uniCloud-aliyun` 目录
2. 选择"运行云函数/云对象" → "运行本地云函数"
3. 在控制台执行以下代码：

```javascript
const db = uniCloud.database()

const rooms = [
  {
    _id: "room_office",
    name: "办公室",
    type: "office",
    bookable: false,
    position: "top-left",
    sort: 1
  },
  {
    _id: "room_meeting1",
    name: "会议室1",
    type: "meeting",
    bookable: true,
    position: "top-center",
    sort: 2
  },
  {
    _id: "room_meeting2",
    name: "会议室2",
    type: "meeting",
    bookable: true,
    position: "top-right",
    sort: 3
  },
  {
    _id: "room_meeting3",
    name: "会议室3",
    type: "meeting",
    bookable: true,
    position: "bottom-left",
    sort: 4
  },
  {
    _id: "room_boardroom",
    name: "董事长室",
    type: "boardroom",
    bookable: true,
    position: "bottom-right",
    sort: 5
  }
]

// 逐个插入房间数据
for (const room of rooms) {
  try {
    await db.collection('meeting-rooms').doc(room._id).set(room)
    console.log(`房间 ${room.name} 初始化成功`)
  } catch (e) {
    console.error(`房间 ${room.name} 初始化失败`, e)
  }
}
```

#### 方式二：通过 uniCloud 控制台
1. 登录 [uniCloud 控制台](https://unicloud.dcloud.net.cn/)
2. 选择对应的服务空间
3. 进入"数据库" → "meeting-rooms"
4. 点击"导入数据"，选择 `meeting-rooms.init_data.json` 文件
5. 冲突模式选择"Insert"

### 3. 认证系统（无需手动初始化）

系统已内置管理员账户，**无需手动创建用户记录**：

- **管理员账号**：`admin`
- **初始密码**：`12345678`

认证逻辑由 `meeting-auth` 云对象处理：
- 首次登录时会自动在 `meeting-users` 表中创建管理员记录
- 普通用户由管理员通过 `createUser` 方法创建（暂不开放注册入口）

### 4. 上传云函数
在 HBuilderX 中，右键点击以下云函数目录，选择"上传部署"：
- `uniCloud-aliyun/cloudfunctions/meeting-auth`
- `uniCloud-aliyun/cloudfunctions/meeting-room`
- `uniCloud-aliyun/cloudfunctions/meeting-admin`
- `uniCloud-aliyun/cloudfunctions/meeting-notify`

## 验证初始化
初始化完成后，可以通过以下方式验证：
1. 在 uniCloud 控制台查看 `meeting-rooms` 集合，应该有5条房间记录
2. 运行小程序，首页应该显示5个房间卡片
3. 办公室卡片置灰不可点击，其他4个房间可点击申请

## 提醒消息配置

### 1. 配置微信订阅消息模板
在微信公众平台申请以下订阅消息模板：

**签到提醒模板**：
- 关键词：会议室名称、开始时间、提醒内容
- 示例：`会议室1 | 2024-01-15 10:00 | 请及时到场签到`

**即将到期提醒模板**：
- 关键词：会议室名称、结束时间、提醒内容
- 示例：`会议室1 | 2024-01-15 11:00 | 使用时间即将结束，请注意`

**审批结果通知模板**：
- 关键词：会议室名称、审批状态、审批意见
- 示例：`会议室1 | 已批准 | 同意使用`

### 2. 更新云函数配置
获取到模板 ID 后，更新 `meeting-notify` 云函数配置：

```javascript
// uniCloud-aliyun/cloudfunctions/meeting-notify/index.js
const CONFIG = {
  APPID: '你的小程序 AppID',
  APPSECRET: '你的小程序 AppSecret',
  TEMPLATES: {
    CHECKIN_REMINDER: '签到提醒模板ID',
    EXPIRING_REMINDER: '即将到期提醒模板ID',
    BOOKING_RESULT: '审批结果通知模板ID'
  }
}
```

### 3. 更新前端配置
更新前端订阅消息配置：

```javascript
// common/subscribeMessage.js
const TEMPLATE_IDS = {
  BOOKING_RESULT: '审批结果通知模板ID',
  CHECKIN_REMINDER: '签到提醒模板ID',
  EXPIRING_REMINDER: '即将到期提醒模板ID'
}
```

### 4. 配置定时触发器
`meeting-notify` 云函数已配置为每分钟执行一次，无需额外配置。

### 5. 提醒时机
- **签到提醒**：会议开始前3分钟发送
- **即将到期提醒**：会议结束前5分钟发送
- **审批结果通知**：管理员审批后立即发送（需在 `meeting-admin` 云对象中集成）

### 6. 防重复提醒
云函数使用 `notified_checkin` 和 `notified_expiring` 字段标记已发送的提醒，避免重复发送。
