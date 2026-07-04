const fs = require('fs').promises;
const path = require('path');
const config = require('../src/config');

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const exists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const copyFileIfMissing = async (sourcePath, targetPath) => {
  if (!(await exists(sourcePath))) {
    return;
  }

  if (await exists(targetPath)) {
    return;
  }

  await ensureDir(path.dirname(targetPath));
  await fs.copyFile(sourcePath, targetPath);
};

const copyAllJsonIfMissing = async (sourceDir, targetDir) => {
  if (!(await exists(sourceDir))) {
    return;
  }

  await ensureDir(targetDir);
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    await copyFileIfMissing(sourcePath, targetPath);
  }
};

const dirIsEmpty = async (dirPath) => {
  if (!(await exists(dirPath))) {
    return true;
  }

  const entries = await fs.readdir(dirPath);
  return entries.length === 0;
};

const copyDirIfEmpty = async (sourceDir, targetDir) => {
  if (!(await exists(sourceDir))) {
    return;
  }

  await ensureDir(targetDir);

  if (!(await dirIsEmpty(targetDir))) {
    return;
  }

  await fs.cp(sourceDir, targetDir, { recursive: true });
};

const seedMutableData = async () => {
  await ensureDir(config.paths.data);
  await ensureDir(config.paths.private);
  await ensureDir(config.paths.backups);
  await ensureDir(config.paths.logs);
  await ensureDir(config.paths.storage);
  await ensureDir(config.paths.uploads);
  await ensureDir(config.paths.galleryAssets);

  const seedDataDir = path.join(config.paths.appRoot, 'data');
  const seedGalleryDir = path.join(config.paths.appRoot, 'assets', 'images', 'gallery');

  await copyAllJsonIfMissing(seedDataDir, config.paths.data);
  await copyDirIfEmpty(seedGalleryDir, config.paths.galleryAssets);
};

seedMutableData()
  .then(() => {
    console.log(`Seed complete. DATA_ROOT=${config.paths.dataRoot}`);
  })
  .catch((error) => {
    console.error('Seed failed', error);
    process.exit(1);
  });
