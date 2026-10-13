# 验收记录

2026-10-13，macOS ARM64；Node 24.19.0、pnpm 11.25.0、Go 1.26.1、Anna CLI 0.1.58 / local runtime 0.2.0a28。

| 检查 | 结果 |
|---|---|
| `pnpm install --frozen-lockfile` | 通过 |
| `pnpm build` | 通过，bundle/index.html 和独立 JS/CSS |
| `pnpm validate`（`anna-app validate --strict`）| 通过，schema dispatcher 0.26.0 |
| `pnpm test` | 5 项通过 |
| `pnpm test:protocol` | 通过，完整双向记录可重新生成 |
| `pnpm test:sampling` | 通过，返回 fixture 内容与 mini-notes-fixture model |
| Go `go vet ./...` | 通过 |
| 三平台交叉编译与 archive 检查 | darwin-arm64 / darwin-x86_64 / windows-x86_64 均通过 |
| macOS ARM64 archive 解压后二进制 describe | 通过 |
| 官方 UI harness：storage 创建、读取、删除 | 实际浏览器操作通过，RPC log 可见 get / set |
| UI 保存清空输入、空白不能保存、删除不复用序号 | 通过 |
| UI → tools.invoke → Executa → sampling | 实际返回 `[-32603] harness started with --no-llm`，符合无 LLM 模式预期 |

独立 sampling 输出：

```text
sampling/createMessage invoke_id=2 request_id=mini-notes-sampling-1
{"data":{"model":"mini-notes-fixture","summary":"明天跟进客户，修复登录问题，并整理 Workshop 内容想法。"},"success":true,"tool":"summarize"}
```

本地 UI 测试确实发现并解决了两个官方 harness 兼容问题：UI runtime 未先 initialize，以及 reverse sampling 内部需要 llm.complete dispatcher grant。兼容范围和理由见 README；未改动官方依赖、未注入 UI summary mock。

`ui-harness.jpg` 为实际运行截图，左侧展示预期错误，右侧展示 storage / tools RPC log。测试使用题目示例笔记，没有真实用户数据。协议日志通过 `pnpm test:protocol` 本地生成，不提交含临时会话数据的 recording。

GitHub Actions 的实际运行状态与各平台原生 smoke test 请查看仓库 Actions / Release；此记录中的本地交叉编译不冒充 Windows 原生执行。
