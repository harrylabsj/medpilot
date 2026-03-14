# MedPilot 演示用法

## 快速启动

```bash
npm install
npm run build
npm run dev -- parse-order --patient pat_001 --text "氯沙坦钾片 50mg，每天早饭后 1 次，每次 1 片"
```

## 演示场景

### 1. 用药指令解析
```bash
npm run dev -- parse-order --patient pat_001 --text "二甲双胍 0.5g，午餐前服用，每日2次"
```

### 2. 依从性分类
运行测试查看依从性判断逻辑：
```bash
npm run test
```

### 3. 初始化健康手册
```bash
npm run dev -- init-manual
```

---

**Tip**：所有命令均在项目根目录执行，无需额外配置。