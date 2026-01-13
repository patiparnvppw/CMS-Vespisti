# Environment Configuration

โปรเจคนี้รองรับการรัน tests บน environments ต่างๆ: **DEV**, **UAT**, และ **PROD**

## Environments

### DEV (Development)

- URL: `http://localhost:3000`
- สำหรับ test ในเครื่อง local

### UAT (User Acceptance Testing)

- URL: `https://uat.cms-vespisti.com`
- สำหรับ test บน staging server

### PROD (Production)

- URL: `https://cms-vespisti.com`
- สำหรับ test บน production (ใช้ระวัง!)

## การใช้งาน

### รัน tests แบบระบุ environment

```bash
# รัน test บน DEV (default)
npm run test:dev

# รัน test บน UAT
npm run test:uat

# รัน test บน PROD
npm run test:prod
```

### รัน tests แบบกำหนด environment เอง

```bash
# ระบุ environment
ENV=uat npm test

# ระบุ environment และ URL เอง
ENV=uat BASE_URL=https://custom-url.com npm test
```

### รัน tests แบบ headed mode

```bash
# เห็น browser ขณะ test
ENV=uat npm run test:headed

# รัน UI mode
ENV=prod npm run test:ui
```

## Configuration

### ใช้ .env file (แนะนำ)

1. Copy `.env.example` เป็น `.env`:

```bash
cp .env.example .env
```

2. แก้ไขค่าใน `.env`:

```bash
ENV=dev
BASE_URL=http://localhost:3000
TEST_USERNAME=myuser@test.com
TEST_PASSWORD=mypassword
```

3. รัน tests:

```bash
npm test
```

### Environment Variables

| Variable        | Description                     | Default         |
| --------------- | ------------------------------- | --------------- |
| `ENV`           | Environment name (dev/uat/prod) | `dev`           |
| `BASE_URL`      | Base URL สำหรับ tests           | ตาม environment |
| `TEST_USERNAME` | Username สำหรับ login           | ตาม environment |
| `TEST_PASSWORD` | Password สำหรับ login           | ตาม environment |

## เข้าถึง environment config ใน tests

```typescript
// ใช้ baseURL ที่ตั้งค่าไว้
test("ทดสอบหน้าแรก", async ({ page }) => {
  await page.goto("/"); // จะใช้ baseURL ตาม environment อัตโนมัติ
});

// หรือระบุ URL เต็ม
test("ทดสอบ external link", async ({ page }) => {
  await page.goto("https://example.com");
});
```

## ตัวอย่าง CI/CD

### GitHub Actions

```yaml
- name: Run UAT tests
  run: ENV=uat npm test

- name: Run PROD tests
  run: ENV=prod npm test
```

### GitLab CI

```yaml
test:uat:
  script:
    - ENV=uat npm test

test:prod:
  script:
    - ENV=prod npm test
```

## คำเตือน

⚠️ **PROD Environment**: ระวังการรัน tests บน production - อาจส่งผลกระทบต่อข้อมูลจริง!

💡 **Tips**:

- ใช้ `.env` สำหรับ local development
- ใช้ environment variables ใน CI/CD
- อย่า commit `.env` เข้า git (มี `.gitignore` ป้องกันแล้ว)
