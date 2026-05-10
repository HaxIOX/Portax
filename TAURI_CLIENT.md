# Portax 桌面客户端（Tauri）KISS 方案

本文描述将当前 Portax（Vite + React）封装为 **Windows 桌面客户端**的最简、稳定、常用方案；后续多平台（macOS / Linux）可沿用同一架构扩展。

## 1. 背景与结论

当前项目在浏览器侧使用 **Web Serial API**（`navigator.serial`）访问串口。桌面端（Tauri 的 WebView）通常**不能依赖** Web Serial，因此桌面客户端需要把串口能力迁移到 **Tauri 的 Rust 后端**，前端只保留 UI、日志、解析与绘图。

**最 KISS 的结论：**
- UI：保持现有 Vite + React 不重写；
- 串口：桌面端统一走 Rust 后端（不走 Web Serial）；
- 功能范围（V1）：只做最常用的“单端口连接 + 收发 + 断开”。

## 2. 目标（可验收）

V1（Windows）验收点：
- 能列出串口（COMx）并选择一个端口连接；
- 支持设置波特率（默认 115200）；
- 能收数据（持续监听，不丢事件、不阻塞 UI）；
- 能发数据（ASCII/HEX 的编码逻辑继续复用前端现有实现）；
- 断开后能再次连接（不崩溃、不残留线程）。

非目标（V1 不做，避免过度设计 / YAGNI）：
- 多端口并发；
- 自动重连策略、复杂流控配置；
- 协议栈/插件系统（Modbus/CAN 等放到后续迭代）。

## 3. 架构（最小闭环）

### 3.1 前后端职责（SRP）

前端（React）负责：
- UI：端口选择、连接状态、日志显示、波形绘制；
- 编解码：ASCII/HEX 输入 -> bytes；bytes -> 文本（按现有逻辑分帧/解析）。

后端（Rust）负责：
- 串口枚举 / 打开 / 关闭 / 写入；
- 后台读循环：读到 bytes 后通过事件推送给前端。

### 3.2 数据通道

- TX：前端 `invoke(serial_write, { data })` -> Rust 写入
- RX：Rust 读到数据 -> `emit("serial:rx", payload)` -> 前端监听事件并进入现有处理流程

保持 DRY 的关键点：**日志/解析/绘图逻辑只在前端保留一份**，Rust 不做任何“按行分帧/协议解析”。

## 4. Rust Command/事件设计（接口最小化）

建议命令（command）：
- `serial_list_ports() -> [{ name, description? }]`
- `serial_open(port_name: string, baud_rate: number) -> void`
- `serial_write(data: number[]) -> void`  （`data` 是 0..255 的字节数组）
- `serial_close() -> void`

建议事件（event）：
- `serial:rx`：payload 为 `number[]`（字节数组）或 `{ data: number[] }`
- （可选）`serial:state`：连接/断开状态变化（V1 可不做）

备注（KISS）：V1 可以约束为“同一时间最多只打开一个端口”，把状态管理简单化。

## 5. 前端改造点（最小侵入）

建议增加一个“传输层抽象”（OCP，便于后续扩展）：
- `serialTransport`：定义 `list/open/close/write/onRx`
- 浏览器构建：`WebSerialTransport`（继续用 `navigator.serial`，不影响现有 Web 版本）
- 桌面构建：`TauriSerialTransport`（用 invoke + listen）

然后把 UI 中的“列端口/连接/断开/发送”入口统一改为调用 `serialTransport`，其余（日志、解析、绘图）尽量不动。

## 6. 开发落地步骤（Windows）

1) 初始化 Tauri（在仓库根目录）
- 生成 `src-tauri/`（Rust 项目）
- 配置前端 dev/build 路径：dev 指向 Vite dev server；build 指向 `dist/`

2) Rust 侧实现最小串口服务
- 使用成熟串口库（例如 Rust `serialport`）
- 全局维护：
  - 当前打开的端口句柄（Option）
  - 一个读线程 + 停止信号（例如 channel / atomic flag）
- 读线程逻辑：
  - 循环读取 bytes（阻塞读或带超时读）
  - 读到数据就向前端 emit `serial:rx`
  - 收到停止信号则退出并清理资源

3) 前端对接
- 启动时调用 `serial_list_ports` 填充列表
- 点击连接：`serial_open`
- 发送：保持现有 ASCII/HEX 编码逻辑，最终调用 `serial_write`
- 接收：监听 `serial:rx`，把 bytes 解码为文本并进入现有 `enqueue/parse/log/chart` 流程
- 断开：`serial_close`

4) 打包验证
- `tauri dev`：开发联调
- `tauri build`：产物安装包/可执行文件

## 7. 风险与约束（提前规避）

- Windows 串口被占用：`open` 需要给出明确错误提示（端口占用/权限/不存在）。
- UI 卡顿：RX 必须走后端线程 + 事件推送，前端仍需做节流/批处理（你现有的批处理逻辑可以继续用）。
- 断开竞态：`close` 必须优先通知读线程停止，再关闭端口句柄（避免读线程阻塞导致无法退出）。

## 8. 后续多平台扩展（保持同一套设计）

只要保持：
- 前端 transport 抽象不变；
- Rust 侧串口服务不依赖平台特性（或在极少数地方做条件编译）；

后续扩平台通常只是：
- CI/打包配置补齐；
- macOS/Linux 的设备权限/规则（例如 udev）在安装说明中补充。

## 9. 版本建议（简便/稳定/常用）

- V1：Tauri + Rust 串口后端（单端口）+ 前端 transport 抽象
- V2：补“自动重连（可开关）+ 更完整的串口参数（数据位/校验/停止位）”
- V3：再考虑协议插件化（Modbus 等），仍然尽量保持“UI 与串口/协议解耦”

