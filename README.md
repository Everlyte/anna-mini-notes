# Mini Notes · Anna App

一个在 **Anna App iframe** 内运行的笔记应用。创建、查看、删除走 Anna storage Host API；总结走 Go Executa 的 reverse JSON-RPC sampling。无需 Anna 账号、login、API key 或云端数据库。

```text
Anna App iframe → AnnaAppRuntime.connect()
                → anna.storage.get / set → legacy runtime_state（本地）/ APS KV（生产）
                → anna.tools.invoke → Go Executa invoke
                                    → sampling/createMessage → host LLM / 独立 fixture
                                    ← content.text → UI summary
```

## 快速开始

依赖：Node.js **22+**、pnpm **11.25.0**、Go **1.24+**（CI 1.26）、Python **3.10+**、[uv](https://docs.astral.sh/uv/getting-started/installation/)。安装 pnpm 可用 `npm install -g pnpm@11.25.0`。Go 与 uv 必须在 PATH。

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm validate                    # anna-app validate --strict
pnpm dev                         # anna-app dev --no-llm --bundle bundle --slug mini-notes
```

打开 CLI 输出的 `http://127.0.0.1:5180/dev/<wid>?t=<token>`。不要直接打开 `index.html` 或用 Vite dev server 代替 Anna harness。首次启动 uvx 需下载官方 Python runtime；若桥接进程首次下载超过 CLI 的 8 秒启动期限，先运行 `uvx --from anna-app-runtime-local==0.2.0a28 anna-app-bridge --help` 完成预热，再重试。已有 Python 可通过 `UV_PYTHON=/path/to/python3` 指定。

默认 `--storage legacy` 是每个 harness window 的内存 `runtime_state`。iframe 内重读可保留数据；**刷新外层 dashboard 或重启 dev 后不保证保留**。实际生产 Anna storage 由 APS KV 支持。此项目不需要 `--storage aps`，也不登录 Anna。

## UI 验收与调用证据

1. 空白输入的保存按钮不可用；输入第一条笔记并保存，输入框清空，列表显示添加序号 `01`。
2. 再保存两条，删除第二条，列表变为 `01`、`03`；再次添加为 `04`，删除不会复用序号。
3. 点击“重新读取”，确认从 Host API 重新获得列表。删除只有在 storage.set 成功后才提交界面变化；失败显示错误，保留原列表。
4. 打开 harness 的 RPC 日志 / 浏览器 Network，查看 `storage.get` 与 `storage.set`。二者参数 key 为 `mini-notes/state`，value 包含 `nextOrder` 和 `notes`。
5. 点击 **Summarize**。应看到 `tools.invoke`，`tool_id=tool-mini-notes-summarizer`、`method=summarize`，终端可看到 `sampling/createMessage invoke_id=...`。
6. 在 `--no-llm` 下 UI **预期显示** `[-32603] harness started with --no-llm` 或等价 sampling/LLM 禁用错误。这证明 UI 真实调用了本地 tool，后者尝试借用 host LLM；这不是后端 sampling 实现失败。

UI harness **没有配置任何 tools.invoke mock，也没有注入 summary fixture**。后端 sampling 用下面的独立命令验证。代码证据：`src/runtime.js` 连接官方 SDK；`src/storage.js` 仅使用 `anna.storage.get/set`；`src/tools.js` 仅调用 `anna.tools.invoke`。项目不使用 localStorage、IndexedDB、自建 HTTP API、前端 LLM 或本地规则总结。

## 后端 sampling 独立验收

```bash
pnpm test:sampling
# 等价：
pnpm exec anna-app executa dev --dir executas/mini-notes \
  --mock-sampling fixtures/sampling.jsonl \
  --invoke summarize \
  --args '{"text":"明天跟客户 follow up\n修复登录 bug\nWorkshop 内容想法"}' --json
```

预期结果的 `data.summary` **逐字等于** fixture 的 `result.content.text`，`model` 为 `mini-notes-fixture`。fixture 只在官方独立 Executa harness 中充当 host LLM。更改 fixture 文本后，结果随之改变；Tool 内没有备用总结。

确认 reverse RPC：Tool 在 **stderr** 写 `sampling/createMessage invoke_id=... request_id=...`；只有真的输出 reverse RPC 才会写此行。需要完整双向证据则运行：

```bash
pnpm test
pnpm test:protocol
cat evidence/protocol.jsonl
```

协议脚本生成随机 `HOST-ONLY-<uuid>` 总结，断言最终输出逐字匹配，因此不能被硬编码 summary 蒙混通过。还覆盖：v2 capability、裸 describe、两个同时待完成的 sampling 逆序返回、等待期间的 health、host 错误原样传播、空输入、v1 sampling 拒绝、无效 JSON、后续请求与 EOF。每行证据含 `direction` 和 `frame`：找 `tool -> host` 的 `sampling/createMessage`，再按 id 对照 `host -> tool` response 和原 invoke response。生成日志默认不进入 Git，避免今后测试真实笔记时意外公开内容。

## 手动 JSON-RPC 测试

```bash
cd executas/mini-notes
go run .
```

逐行输入（每行是一个完整 JSON）：

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2.0","capabilities":{"sampling":{}}}}
{"jsonrpc":"2.0","id":2,"method":"describe"}
{"jsonrpc":"2.0","id":3,"method":"invoke","params":{"tool":"summarize","arguments":{"text":"明天跟进客户"},"context":{"invoke_id":"manual-3"}}}
```

第三步 Tool 会输出 `method=sampling/createMessage` 的请求。复制其 id，手动输入 host 回复，例如本进程第一次调用的 id 是：

```json
{"jsonrpc":"2.0","id":"mini-notes-sampling-1","result":{"role":"assistant","content":{"type":"text","text":"这是手动 host 提供的总结"},"model":"manual-host","stopReason":"endTurn"}}
```

然后收到原 `id=3` 的成功结果。可以继续输入 `health`、`describe` 等请求。终端 Ctrl-D 表示 EOF；也支持 `shutdown`。stdout 只有 JSON-RPC 请求/响应（reverse RPC 也是协议帧），所有日志走 stderr；每个帧直接 `os.Stdout.Write`，无缓冲待 flush。pending map 支持多个 reverse RPC，60 秒超时，最多 8 个同时等待的请求。

## 本机二进制与归档

```bash
pnpm package:binary
python3 scripts/test_archive.py
# 可选交叉编译（无需目标平台解释器）：
python3 scripts/package_binary.py --platform darwin-arm64
python3 scripts/package_binary.py --platform darwin-x86_64
python3 scripts/package_binary.py --platform windows-x86_64
```

默认检测当前机器 OS/CPU，Go `CGO_ENABLED=0` 生成独立二进制。macOS 用 `.tar.gz`，Windows 用 `.zip`。产物在 `dist/`，并提供 SHA256 sidecar。archive **根目录**是：

```text
manifest.json
bin/mini-notes          # Windows 为 bin/mini-notes.exe
```

archive manifest 包含 name、version、tools、host_capabilities，以及准确的 `runtime.binary.entrypoint` 和 `permissions`（`0o755`）；tar 本身保留执行位。没有额外包裹目录。`test_archive.py` 检查布局、manifest、权限，并在本机平台解压后真实运行 `describe`。交叉编译产物只能检查结构，执行测试由各原生 CI runner 完成。

## GitHub Actions Release

`.github/workflows/release.yml` 支持推送 `v*` tag 或 **Actions → Release Executa binaries → Run workflow**（tag 默认 `v1.0.1`）。tag 必须匹配 Tool manifest 版本。

一次运行由 macOS ARM、macOS Intel、Windows x64 三个原生 runner 构建并测试，再统一上传 **GitHub Release assets**：

- `mini-notes-1.0.1-darwin-arm64.tar.gz`
- `mini-notes-1.0.1-darwin-x86_64.tar.gz`
- `mini-notes-1.0.1-windows-x86_64.zip`
- 各文件对应的 `.sha256`

workflow artifacts 仅负责构建 job 间传递，最终 release job 使用 `gh release upload`。无需个人 PAT，使用仓库 `GITHUB_TOKEN`，只给 release job `contents: write`。本题无需发布到 Anna 商店，无需签名/公证。

## 项目结构与平台概念

```text
src/                      UI、runtime 连接、storage、tools 四层
index.html                Vite 源入口
bundle/                   pnpm build 生成的静态 bundle（不提交）
manifest.json             Anna App 权限、工具依赖、窗口与 bundle 入口
app.json                  App 元数据与 bundled_executas 开发目录映射
executas/mini-notes/       Go 源码、嵌入式 describe manifest、发现配置
fixtures/sampling.jsonl   官方独立 Executa mock sampling fixture
scripts/                  协议验收、本机打包、归档 smoke test
tests/                   storage/Tool wiring 与身份一致性测试
.github/workflows/        三平台 Release workflow
```

- **Anna App** 是组合静态 UI 与 Executas 的平台应用。**manifest** 声明宿主授予的 API、工具依赖和窗口。
- **bundle** 是 `pnpm build` 产物。`ui.bundle.entry=index.html` 是相对于 `--bundle bundle` 的路径，即最终 `bundle/index.html`，不是源码入口文件的绝对路径。
- **Executa** 是宿主管理的 stdio 子进程。UI `tools.invoke` 的 ID、App 两处声明、executa.json、describe manifest 使用同一 `tool-mini-notes-summarizer` 本地身份。正式 Anna 上架才需要换成平台 minted ID，并同步这些位置。
- **storage / APS KV** 是同一个 Host API 的本地 legacy / 生产持久化实现。这里只用 App 自身默认 scope，不请求跨 App 存储。
- **sampling** 是 Tool 向 host 发起反向 RPC 借用模型。initialize 对 v2 声明 `client_capabilities.sampling={}`，manifest 声明 `llm.sample`，metadata 携带当前 invoke_id（优先 context，再兼容顶层）。
- **binary archive** 把编译后的 Tool 与安装 manifest 放在一起，供 Anna 安装器按平台键选包、识别入口和设置权限；不是需要用户安装 Go 的源码发布。

采用 **schema 2** 是为了满足题目要求的 `permissions` 字段：官方 schema 3 已移除此字段。schema 2 的 permissions 仅是展示/审计元数据，实际调用权限由 `ui.host_api.storage/tools` 控制。本地开发基于官方 CLI 0.1.58，锁文件固定依赖。

## 当前官方 harness 的握手兼容

CLI 0.1.58 使用的 UI Python runtime 0.2.0a28 直接发送 invoke，没有 initialize；独立 `executa dev` 则会完成 v2 握手。为使 UI 路径实际发起 sampling 并得到 `--no-llm` 的宿主错误，`executa.json` 的本地 Go 命令显式带 `--legacy-harness`：只允许尚未收到 initialize 的开发调用；收到明确 v1 握手后仍拒绝 sampling。默认二进制与手动协议测试不带该开关，严格要求 v2。它不生成任何 mock summary，也不绕过宿主授权；最终禁用错误仍由 Anna 返回。reverse RPC 还携带 context.invoke_id 供此版本 harness 路由，metadata 保留审计关联。

此外，此版本 UI harness 将 Tool 的 sampling 内部映射到 dispatcher 的 `llm.complete`，因此 App manifest 需要 `ui.host_api.llm=["complete"]` 才能到达 `--no-llm` 禁用检查。**前端代码从不调用 anna.llm.complete**；该声明只是官方本地桥接器的要求，总结链路仍是 UI → Tool → reverse sampling。

## 范围与限制

一次最多 100 条笔记、每条 2,000 字，超出 Host storage 字节限额时显示宿主错误，不丢弃输入。单窗口内操作串行，避免快速连点覆盖。legacy storage 没有 CAS，多个独立窗口同时写同一 state 可能后写覆盖前写；此练习声明 single_instance，不声称提供协同编辑或跨窗口事务。未接入真实 LLM，mock 只验证协议路径与结果来源。

## 参考

- [Anna Developer Hub](https://staging.anna.partners/developers)
- [官方示例仓库](https://github.com/whtcjdtc2007/anna-executa-examples)
- [本地开发](https://staging.anna.partners/developers/apps/local-dev)
- [Sampling](https://staging.anna.partners/developers/tools/executa-sampling)
- [Binary distribution](https://staging.anna.partners/developers/tools/executa-binary)

验收执行记录见 [evidence/verification.md](evidence/verification.md)。
