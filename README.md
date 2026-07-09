# 产业招商助手 (investment-assistant)

面向产业招商场景的全栈助手：企业库 / 产业图谱 / 政策库 / 物业资源库 / AI 招商研判 / 招商流程 / 招商报告，并内置**离线 OCR 引擎**与**资料库**（上传文本 / PDF / 图片，扫描件与图片自动 OCR 识别入库）。

- 后端：FastAPI + SQLAlchemy + SQLite + DeepSeek LLM（function calling / SSE 流式）
- 前端：React 19 + TypeScript + Vite + TailwindCSS v4 + React Query + ECharts
- OCR：RapidOCR（纯 ONNX，离线中文识别，无需 GPU / 无需联网）

---

## 功能一览

| 模块 | 说明 |
| --- | --- |
| 工作台 Dashboard | ECharts 可视化大屏：招商漏斗 / 行业分布 / 投资评级 / 地区分布 |
| 企业库 | 列表 + 详情 + 画像分析 + 资源匹配 |
| 产业图谱 | 节点 / 连线 / 企业关联管理 |
| 政策库 / 物业资源库 | 增删改查 |
| AI 助手 | 多段对话历史、SSE 流式、function calling、文件上传分析 |
| 招商研判报告 / 流程 | 报告生成与招商流程编排 |
| **资料库（新增）** | 上传文本 / PDF / 图片，自动解析并入库，可预览 / 删除 |
| **OCR 引擎（新增）** | 扫描件 PDF 逐页识别、图片直接识别，结果写入资料库并标记 `OCR: RapidOCR` |

---

## 目录结构

```
investment-assistant/
├── backend/
│   ├── main.py                # FastAPI 入口，启动时自动建表+灌种子数据
│   ├── database.py            # SQLAlchemy 引擎 / Session
│   ├── seed.py                # 种子数据（企业/政策/物业/产业图谱）
│   ├── models/                # ORM 模型（含 document.py 资料库表）
│   ├── routers/               # API 路由（upload / documents / stats / ...）
│   ├── services/
│   │   ├── ocr.py             # 主进程：子进程隔离调用 OCR
│   │   └── ocr_worker.py      # 子进程：RapidOCR 实际识别
│   ├── requirements.txt
│   └── .env                   # DEEPSEEK_API_KEY（已被 .gitignore 忽略）
└── frontend/
    ├── src/pages/             # Dashboard / EnterpriseList / Documents / AIChat ...
    ├── src/api/               # config.ts / client.ts / documents.ts / stats.ts
    └── vite.config.ts         # 本地代理端口可配（VITE_API_PORT，默认 8001）
```

---

## 本地开发

### 1. 后端

```bash
cd backend

# 建议用虚拟环境（项目当前使用 managed venv）
python -m venv venv
source venv/Scripts/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

# 配置密钥（复制模板后填入 DeepSeek API Key）
cp .env.example .env
# 编辑 .env: DEEPSEEK_API_KEY=sk-xxxx

# 启动（默认 8001）
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

- 健康检查：`GET http://localhost:8001/api/health`
- 首次启动：库为空时 **自动灌入种子数据**（11 企业 / 5 政策 / 4 物业 / 1 产业图谱），无需手动 seed。
- OCR 模型：RapidOCR 首次运行会下载 ONNX 模型到本地缓存（需联网一次），之后完全离线。

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

- 默认 `http://localhost:5178`
- 本地代理：`/api` → `http://localhost:${VITE_API_PORT||8001}`。
  若后端不在 8001（例如临时跑在 8011），可用环境变量覆盖，无需改动配置文件：

  ```bash
  VITE_API_PORT=8011 npm run dev
  ```

> ⚠️ **开发踩坑：残留旧进程占用 8001**
> 若 8001 返回旧接口（如 `/api/files` 404），通常是上次会话残留的 uvicorn 仍在监听。
> 本机会话间进程互相不可见，需在**你自己的终端**清理后重启：
> ```powershell
> netstat -ano | findstr :8001
> taskkill /PID <查到的PID> /F
> # 再回到 backend 目录重启
> uvicorn main:app --port 8001 --reload
> ```

---

## 环境变量

`backend/.env`（已 gitignore，请勿提交密钥）：

| 变量 | 说明 |
| --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（AI 对话必须） |
| `DEEPSEEK_BASE_URL` | 可选，默认 `https://api.deepseek.com/v1` |
| `DEEPSEEK_MODEL` | 可选，默认 `deepseek-chat` |
| `DATABASE_URL` | 可选，默认 `sqlite:///./investment.db` |

---

## 资料库 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/files/upload` | 上传文件（文本 / PDF / 图片），自动解析 + OCR（如需要）+ 入库 |
| GET | `/api/files` | 资料库列表（含 `ocr_used` / `ocr_engine` / 内容预览） |
| DELETE | `/api/files/{id}` | 删除指定资料 |

上传内容上限：PDF / OCR 文本截断 8000 字；图片直接 OCR 后同样截断。

---

## 部署

- **后端（Railway 等）**：构建命令 `pip install -r requirements.txt`，启动命令
  `uvicorn main:app --host 0.0.0.0 --port $PORT`。在平台环境变量中设置 `DEEPSEEK_API_KEY`。
  由于 `investment.db` 被 gitignore，任意环境 clone / 部署后**首次启动自动建库灌数据**。
- **前端（Vercel 等）**：`npm install && npm run build`，用环境变量配置生产 API 地址
  （见 `frontend/src/api/config.ts`）。

---

## 常见命令

```bash
# 本地启动（标准端口）
cd backend && uvicorn main:app --port 8001 --reload
cd frontend && npm run dev

# 类型检查
cd frontend && npm run build

# 提交（需自行在终端推送，本仓库 .env / *.db 均不入库）
git add -A && git commit -m "feat: ..."
git push origin master
```
