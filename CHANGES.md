# MedPilot 变更日志

## v0.2.0-rc (2026-03-14) - 可发布候选版

### 新增功能

#### 1. 完整 Reminder/Intake 状态流
- 新增 `src/services/reminder.ts` - 完整的提醒状态流转实现
- 支持状态：scheduled → triggered → completed/missed/skipped
- 支持医生跳过和患者跳过两种跳过类型
- 状态流转有严格的校验规则，防止非法状态变更
- reminder instance 模型支持单次提醒追踪

#### 2. 更合理的 Expected Dose / Report 统计
- 改进了预期服药次数计算逻辑：
  - 考虑 reminder 的生效时间范围（effectiveFrom/effectiveTo）
  - 与报告周期取交集，避免重复计算
  - 支持多个 reminder 的累加计算
- 新增 `summarizeAdherenceWithExpected()` 函数
- 医生跳过的不计入依从性分母
- 周报现在显示：应服药次数、实际记录次数、按时/延迟完成次数

#### 3. 最小 API 服务器
- 新增 `src/api.ts` - HTTP API 服务器
- 可用端点：
  - `GET /health` - 健康检查
  - `GET /api/patients/:id` - 患者概览
  - `GET /api/patients/:id/reminders` - 活跃提醒列表
  - `GET /api/patients/:id/expected-intakes` - 预期服药计划
  - `GET /api/patients/:id/report` - 生成周报
  - `POST /api/orders` - 录入医嘱
  - `POST /api/intakes` - 记录服药
  - `POST /api/intakes/skip` - 跳过服药
  - `POST /api/metrics` - 记录指标
- 支持 CORS，可被前端直接调用
- 可通过环境变量配置端口和基础目录

#### 4. 新增测试
- 新增 `tests/adherence-enhanced.test.ts` - 11 个增强测试用例
- 总测试数从 37 个增加到 48 个

### 改进

#### 1. 持久化
- JSON 文件持久化已完全可用
- JsonStore 类提供事务支持
- 数据自动保存到 data/db.json

#### 2. 报告生成
- 周报现在使用改进的依从性统计方法
- 显示更详细的信息（应服药次数、实际记录次数等）

### 技术变更

#### 新增导出
- `src/index.ts` 新增导出 reminder 相关函数
- 修复了重复导出问题

#### 包配置
- 更新 `package.json` 中的 main 和 bin 路径
- 新增 `api` 和 `api:dev` 脚本

---

## v0.1.0 (2026-03-14) - MVP 骨架

### 核心功能
- TypeScript 项目骨架
- MVP 核心数据模型
- 基础医嘱文本解析
- 服药依从性判定逻辑
- 基础安全规则（血压/空腹血糖）
- HealthManual 目录初始化与摘要写入服务
- CLI 入口
- 基础单元测试（37 个）

### 已知问题
- 依从性统计未区分"无记录"与"差依从"
- 无持久化层
- 无 API 层
- 无提醒调度器
