# CMS Vespisti - Automated E2E Testing

Automated end-to-end testing suite for CMS Vespisti using Playwright.

## 🚀 Features

- ✅ Multi-environment support (DEV, UAT, PROD)
- ✅ Cross-browser testing (Chrome, Safari, Firefox)
- ✅ Authentication flow testing
- ✅ ADFS/SAML integration testing
- ✅ Automated screenshots and videos on failure
- ✅ HTML test reports
- ✅ CI/CD ready

## 📋 Prerequisites

- Node.js 16+ 
- npm or yarn

## 🛠️ Installation

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/CMS-Vespisti.git
cd CMS-Vespisti

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

## ⚙️ Configuration

1. Copy environment template:
```bash
cp .env.example .env
```

2. Edit `.env` with your credentials:
```bash
ENV=dev
BASE_URL=https://vespistiid-backend-dev.vespiario.net/
TEST_USERNAME=your-email@vespiario.net
TEST_PASSWORD=your-password
```

## 🧪 Running Tests

### Basic Commands

```bash
# Run all tests (default environment)
npm test

# Run with UI mode (recommended for development)
npm run test:ui

# Run tests in headed mode (see browser)
npm run test:headed

# Debug mode
npm run test:debug
```

### Environment-Specific

```bash
# DEV environment (Chrome + Safari)
npm run test:dev

# UAT environment
npm run test:uat

# PROD environment (use with caution!)
npm run test:prod
```

### Browser-Specific

```bash
# Chrome only
npm run test:chrome

# Safari only
npm run test:safari

# Firefox only
npm run test:firefox

# Chrome + Safari
npm run test:chrome-safari
```

## 📊 Test Reports

```bash
# Show latest HTML report
npm run test:report
```

Reports are generated in `playwright-report/` directory.

## 📁 Project Structure

```
CMS-Vespisti/
├── tests/
│   ├── auth.spec.ts        # Authentication tests
│   ├── content.spec.ts     # Content management tests
│   ├── example.spec.ts     # Example tests
│   └── fixtures.ts         # Custom fixtures
├── playwright.config.ts    # Playwright configuration
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables (not committed)
├── .env.example          # Environment template
└── ENV_CONFIG.md         # Environment configuration guide
```

## 🔐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENV` | Environment (dev/uat/prod) | `dev` |
| `BASE_URL` | Application base URL | Environment-specific |
| `TEST_USERNAME` | Test user email | `test@vespiario.net` |
| `TEST_PASSWORD` | Test user password | `T12345678` |

## 🧩 Test Suites

### Authentication Tests (`auth.spec.ts`)
- ✅ Login page visibility
- ✅ ADFS redirect
- ✅ Form validation (empty fields, invalid email, invalid password)
- ✅ Successful login
- ✅ Sign out functionality
- ✅ Session management

### Content Management Tests (`content.spec.ts`)
- ✅ Content listing
- ✅ Create content
- ✅ Search functionality
- ✅ Filter by category

## 🚀 CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:dev
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## 🛡️ Best Practices

1. **Don't commit `.env`** - Contains sensitive credentials
2. **Use data-testid** - For stable element selection
3. **Keep tests independent** - Each test should work standalone
4. **Use fixtures** - For common setup (authentication, etc.)
5. **Run on CI** - Automate testing on every push

## 📝 Writing New Tests

```typescript
import { test, expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('/your-page');
  await page.locator('#element').click();
  await expect(page).toHaveURL(/expected-url/);
});
```

## 🐛 Debugging

```bash
# Run specific test file
npm test tests/auth.spec.ts

# Run specific test by name
npx playwright test -g "sign in success"

# Debug mode (step-by-step)
npm run test:debug

# Headed mode (see browser)
npm run test:headed
```

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Test Best Practices](https://playwright.dev/docs/best-practices)
- [Environment Configuration Guide](./ENV_CONFIG.md)

## 📄 License

ISC

## 👥 Contributing

1. Create feature branch
2. Write tests
3. Run tests locally
4. Submit pull request

## 📞 Support

For issues and questions, please open an issue on GitHub.
