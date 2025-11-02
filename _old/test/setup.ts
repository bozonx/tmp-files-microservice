/**
 * Настройка тестового окружения
 * Автоматически загружает переменные окружения из env.test
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Загружаем тестовые переменные окружения
const testEnvPath = path.join(__dirname, '..', 'env.test');
dotenv.config({ path: testEnvPath });

// Устанавливаем NODE_ENV для тестов
process.env.NODE_ENV = 'test';

console.log('🧪 Test environment setup completed');
console.log(`📁 Test env file: ${testEnvPath}`);
console.log(`🔧 NODE_ENV: ${process.env.NODE_ENV}`);
