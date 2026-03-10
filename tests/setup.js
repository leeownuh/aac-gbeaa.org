const fs = require('fs').promises;
const path = require('path');

const TEST_DIR = path.join(__dirname, '.test-data');

async function setupTestEnvironment() {
  try {
    await fs.mkdir(TEST_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to setup test environment:', error);
  }
}

async function cleanupTestEnvironment() {
  try {
    const files = await fs.readdir(TEST_DIR);
    for (const file of files) {
      await fs.unlink(path.join(TEST_DIR, file));
    }
    await fs.rmdir(TEST_DIR);
  } catch (error) {
  }
}

global.TEST_DIR = TEST_DIR;

beforeAll(setupTestEnvironment);
afterAll(cleanupTestEnvironment);