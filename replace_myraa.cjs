const fs = require('fs');
const path = require('path');

const targetExtensions = ['.js', '.ts', '.tsx', '.json', '.html', '.md', '.css'];
const skipDirs = ['node_modules', '.git', 'dist', 'build', '.vscode', '.gemini', 'assets', 'Software', 'Research', 'public'];

function walkAndReplace(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!skipDirs.includes(file)) {
        walkAndReplace(fullPath);
      }
    } else {
      const ext = path.extname(file);
      if (targetExtensions.includes(ext) || file === '.env.example' || file === '.env') {
        let content = fs.readFileSync(fullPath, 'utf8');
        let newContent = content;
        
        // Use regex for word replacement
        newContent = newContent.replace(/Myraa/g, 'Aria');
        newContent = newContent.replace(/myraa/g, 'aria');
        newContent = newContent.replace(/MYRAA/g, 'ARIA');

        if (content !== newContent) {
          fs.writeFileSync(fullPath, newContent, 'utf8');
          console.log(`Replaced in: ${fullPath}`);
        }
      }
    }
  }
}

const rootDir = 'c:\\Users\\Monojit Main\\Downloads\\MY AI';
console.log('Starting replacement...');
walkAndReplace(rootDir);
console.log('Finished replacement.');
