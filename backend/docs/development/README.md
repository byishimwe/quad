# 🛠️ **Development Setup Documentation**

## 📋 **Overview**

This guide covers everything you need to set up a local development environment for the Quad backend, including prerequisites, installation, configuration, and development workflows.

---

## 🚀 **Quick Start (5 Minutes)**

### **Prerequisites Check**

```bash
# Check Node.js version (requires 18+)
node --version

# Check npm version
npm --version

# Check git
git --version
```

### **Rapid Setup**

```bash
# Clone the repository
git clone https://github.com/ISHIMWE-Prince-Arnaud/Quad.git
cd Quad
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start development server
npm run dev
```

---

## 🔧 **Detailed Setup Instructions**

### **1. System Requirements**

#### **Minimum Requirements**

- **Node.js**: 18.0+ (LTS recommended)
- **npm**: 8.0+ or **yarn**: 1.22+
- **Git**: 2.30+
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space

#### **Recommended Development Tools**

- **Visual Studio Code** with extensions:
  - TypeScript and JavaScript Language Features
  - Prettier - Code formatter
  - ESLint
  - Thunder Client (API testing)
  - MongoDB for VS Code
- **MongoDB Compass** (GUI for database)
- **Postman** or **Insomnia** (API testing)

### **2. Node.js Installation**

#### **Using Node Version Manager (Recommended)**

```bash
# Install nvm (Linux/macOS)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install nvm (Windows - use nvm-windows)
# Download from: https://github.com/coreybutler/nvm-windows

# Install and use the repository version
nvm install 24.19.0
nvm use 24.19.0
nvm alias default 24.19.0
```

#### **Direct Installation**

- Download from [nodejs.org](https://nodejs.org/)
- Install Node.js 24.19.0, matching the repository `.nvmrc`
- Follow installation wizard

### **3. Project Setup**

#### **Clone Repository**

```bash
# Using HTTPS
git clone https://github.com/ISHIMWE-Prince-Arnaud/Quad.git

# Using SSH (if configured)
git clone git@github.com:ISHIMWE-Prince-Arnaud/Quad.git

# Navigate to project directory
cd Quad/backend
```

#### **Install Dependencies**

```bash
# Using npm
npm install

# Using yarn (alternative)
yarn install

# Verify installation
npm list --depth=0
```

---

## ⚙️ **Environment Configuration**

### **Environment Variables Setup**

#### **Copy Template**

```bash
cp .env.example .env
```

#### **Development Environment Variables**

Edit `.env` file:

```bash
# ================================
# SERVER CONFIGURATION
# ================================
NODE_ENV=development
PORT=3001

# ================================
# DATABASE
# ================================
# Option 1: Local MongoDB
MONGODB_URI=mongodb://localhost:27017/quad-dev

# Option 2: MongoDB Atlas (recommended)

SKIP_INDEX_CREATION=false

# ================================
# AUTHENTICATION (Clerk - Development)
# ================================
CLERK_PUBLISHABLE_KEY=pk_test_<CLERK_PUBLISHABLE_KEY>
CLERK_SECRET_KEY=sk_test_<CLERK_SECRET_KEY>
CLERK_WEBHOOK_SECRET=whsec_<CLERK_WEBHOOK_SECRET>

# ================================
# MEDIA STORAGE (Cloudinary - Development)
# ================================
CLOUDINARY_CLOUD_NAME=<CLOUDINARY_CLOUD_NAME>
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=<CLOUDINARY_API_SECRET>

# ================================
# FRONTEND
# ================================
FRONTEND_URL=http://localhost:5173
```

### **Development Services Setup**

#### **Option 1: MongoDB Atlas (Recommended)**

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create free account
3. Create new cluster
4. Add database user
5. Whitelist your IP address
6. Get connection string

#### **Option 2: Local MongoDB**

```bash
# Install MongoDB (Ubuntu/Debian)
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# macOS with Homebrew
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

#### **Clerk Development Setup**

1. Sign up at [Clerk.com](https://clerk.com)
2. Create new application
3. Get development keys from dashboard
4. Configure allowed domains (localhost:3000)

#### **Cloudinary Development Setup**

1. Sign up at [Cloudinary.com](https://cloudinary.com)
2. Get account details from dashboard
3. Create upload presets for development

---

## 🏃‍♂️ **Development Workflow**

### **Available Scripts**

#### **Development Scripts**

```bash
# Start development server with hot reload
npm run dev

# Start development server with debugging
npm run dev:debug

# Build TypeScript
npm run build

# Start production build locally
npm start

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Format code
npm run format

# Run tests
npm test
npm run test:watch
npm run test:coverage
```

#### **Database Scripts**

```bash
# Seed development data
npm run seed

# Reset database
npm run db:reset

# Run migrations
npm run migrate

# Create indexes
npm run indexes
```

### **Development Server Features**

#### **Hot Reload Configuration**

The development server uses `nodemon` for automatic restarts:

```json
// nodemon.json
{
  "watch": ["src"],
  "ext": "ts,js",
  "ignore": ["src/**/*.test.ts"],
  "exec": "ts-node src/server.ts"
}
```

#### **TypeScript Compilation**

```json
// tsconfig.json (development settings)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 🧪 **Testing Setup**

### **Test Configuration**

#### **Jest Configuration**

```javascript
// jest.config.js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/*.spec.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
};
```

#### **Test Database Setup**

```typescript
// src/tests/setup.ts
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});
```

### **Writing Tests**

#### **Unit Test Example**

```typescript
// src/utils/__tests__/validation.test.ts
import { validateEmail, validatePassword } from "../validation.util";

describe("Validation Utilities", () => {
  describe("validateEmail", () => {
    it("should validate correct email formats", () => {
      expect(validateEmail("test@example.com")).toBe(true);
      expect(validateEmail("user.name+tag@domain.co.uk")).toBe(true);
    });

    it("should reject invalid email formats", () => {
      expect(validateEmail("invalid-email")).toBe(false);
      expect(validateEmail("test@")).toBe(false);
      expect(validateEmail("@domain.com")).toBe(false);
    });
  });

  describe("validatePassword", () => {
    it("should validate strong passwords", () => {
      expect(validatePassword("StrongPass123!")).toBe(true);
    });

    it("should reject weak passwords", () => {
      expect(validatePassword("weak")).toBe(false);
      expect(validatePassword("123456")).toBe(false);
    });
  });
});
```

#### **Integration Test Example**

```typescript
// src/controllers/__tests__/user.controller.test.ts
import request from "supertest";
import { app } from "../../server";
import { User } from "../../models/User.model";

describe("User Controller", () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe("POST /api/users", () => {
    it("should create a new user", async () => {
      const userData = {
        username: "testuser",
        email: "test@example.com",
        displayName: "Test User",
      };

      const response = await request(app)
        .post("/api/users")
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe(userData.username);
    });

    it("should return 400 for invalid data", async () => {
      const invalidData = {
        username: "", // Invalid: empty username
        email: "invalid-email", // Invalid: malformed email
      };

      const response = await request(app)
        .post("/api/users")
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
```

---

## 🔍 **Debugging**

### **VS Code Debug Configuration**

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug TypeScript",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/server.ts",
      "preLaunchTask": "tsc: build - tsconfig.json",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      },
      "envFile": "${workspaceFolder}/.env",
      "sourceMaps": true,
      "restart": true,
      "protocol": "inspector",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### **Debugging Tools**

#### **Console Debugging**

```typescript
// Use the logger utility instead of console.log
import { logger } from "../utils/logger.util";

// Development logging
logger.debug("Debugging user creation", { userId, userData });
logger.info("User created successfully", { userId });
logger.warn("Potential issue detected", { issue });
logger.error("Error creating user", error);
```

#### **Database Debugging**

```typescript
import { logger } from "../utils/logger.util";

// Enable Mongoose debugging
if (process.env.NODE_ENV === "development") {
  mongoose.set("debug", true);
}

// Query debugging
const users = await User.find().explain("executionStats");
logger.debug("Query execution stats", users);
```

---

## 📦 **Package Management**

### **Adding Dependencies**

#### **Production Dependencies**

```bash
# Add new dependency
npm install package-name

# Add specific version
npm install package-name@1.2.3

# Add from GitHub
npm install user/repo#branch
```

#### **Development Dependencies**

```bash
# Add dev dependency
npm install --save-dev package-name

# Add types for TypeScript
npm install --save-dev @types/package-name
```

### **Dependency Management**

#### **Update Dependencies**

```bash
# Check outdated packages
npm outdated

# Update all dependencies
npm update

# Update specific package
npm install package-name@latest

# Interactive updater
npx npm-check-updates -u
npm install
```

#### **Security Auditing**

```bash
# Check for vulnerabilities
npm audit

# Fix automatically fixable issues
npm audit fix

# Force fix (use with caution)
npm audit fix --force
```

---

## 🔧 **Code Quality Tools**

### **ESLint Configuration**

```json
// .eslintrc.json
{
  "extends": ["@typescript-eslint/recommended", "prettier"],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "prefer-const": "error",
    "no-var": "error"
  },
  "env": {
    "node": true,
    "es2022": true
  }
}
```

### **Prettier Configuration**

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### **Pre-commit Hooks**

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,js}": ["eslint --fix", "prettier --write", "git add"]
  }
}
```

---

## 📊 **Development Monitoring**

### **Performance Monitoring**

```typescript
// Add to server.ts for development
if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      logger.debug(
        `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`,
      );
    });
    next();
  });
}
```

### **Memory Usage Monitoring**

```typescript
// Monitor memory usage in development
setInterval(() => {
  if (process.env.NODE_ENV === "development") {
    const used = process.memoryUsage();
    logger.debug("Memory usage:", {
      rss: `${Math.round((used.rss / 1024 / 1024) * 100) / 100} MB`,
      heapTotal: `${Math.round((used.heapTotal / 1024 / 1024) * 100) / 100} MB`,
      heapUsed: `${Math.round((used.heapUsed / 1024 / 1024) * 100) / 100} MB`,
    });
  }
}, 60000); // Every minute
```

---

## 🛠️ **Common Development Tasks**

### **Database Operations**

#### **Seeding Development Data**

```typescript
// scripts/seed.ts
import mongoose from "mongoose";
import { User } from "../src/models/User.model";
import { Post } from "../src/models/Post.model";
import { logger } from "../src/utils/logger.util";

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);

    // Clear existing data
    await User.deleteMany({});
    await Post.deleteMany({});

    // Create test users
    const users = await User.create([
      {
        clerkId: "test_user_1",
        username: "john_doe",
        email: "john@example.com",
        displayName: "John Doe",
      },
      {
        clerkId: "test_user_2",
        username: "jane_smith",
        email: "jane@example.com",
        displayName: "Jane Smith",
      },
    ]);

    // Create test posts
    await Post.create([
      {
        userId: users[0].clerkId,
        content: "Hello from the development environment!",
        tags: ["development", "testing"],
      },
      {
        userId: users[1].clerkId,
        content: "Another test post with some content",
        tags: ["test", "content"],
      },
    ]);

    logger.success("Database seeded successfully!");
    process.exit(0);
  } catch (error) {
    logger.error("Seeding failed", error);
    process.exit(1);
  }
};

seedData();
```

#### **Running Seed Script**

```bash
# Add to package.json scripts
"seed": "ts-node scripts/seed.ts"

# Run seeding
npm run seed
```

### **API Testing**

#### **Using Thunder Client (VS Code)**

Create test collections in `.vscode/thunder-tests/`:

```json
// thunderclient.json
{
  "client": "Thunder Client",
  "collectionName": "Quad API Development",
  "dateExported": "2024-01-01",
  "version": "1.1",
  "folders": [],
  "requests": [
    {
      "name": "Create User",
      "url": "http://localhost:3001/api/users",
      "method": "POST",
      "headers": [
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ],
      "body": {
        "type": "json",
        "raw": "{\n  \"username\": \"testuser\",\n  \"email\": \"test@example.com\",\n  \"displayName\": \"Test User\"\n}"
      }
    }
  ]
}
```

---

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Port Already in Use**

```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>

# Or use different port
PORT=3002 npm run dev
```

#### **MongoDB Connection Issues**

```bash
# Check MongoDB status (local)
sudo systemctl status mongod

# Test connection
mongosh mongodb://localhost:27017/quad-dev

# Check connection string format
node -p "process.env.MONGODB_URI"
```

#### **TypeScript Compilation Errors**

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check TypeScript configuration
npx tsc --showConfig
```

#### **Environment Variables Not Loading**

```bash
# Check if .env file exists
ls -la .env

# Verify environment variables
node -p "require('dotenv').config(); process.env.NODE_ENV"

# Check for syntax errors in .env
cat .env | grep -E '^[^#].*='
```

---

## 📝 **Development Best Practices**

### **Code Organization**

1. **Follow TypeScript conventions** and use strict mode
2. **Use meaningful variable and function names**
3. **Write self-documenting code** with clear comments
4. **Implement proper error handling** with try-catch blocks
5. **Use consistent formatting** with Prettier

### **Git Workflow**

1. **Create feature branches** for new development
2. **Write descriptive commit messages**
3. **Keep commits small and focused**
4. **Test before committing**
5. **Use pull requests** for code review

### **Performance Tips**

1. **Use database indexes** for query optimization
2. **Implement caching** for frequently accessed data
3. **Monitor memory usage** and fix leaks
4. **Profile slow operations** and optimize
5. **Use lazy loading** where appropriate

---

This development guide provides everything needed to set up a productive development environment for the Quad backend, from initial setup to advanced debugging and testing strategies.
