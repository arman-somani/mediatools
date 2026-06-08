const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== 'dist' && file !== '.git' && file !== '.next') {
                processDir(fullPath);
            }
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('—')) {
                const newContent = content.replace(/—/g, '?');
                fs.writeFileSync(fullPath, newContent, 'utf8');
                console.log('Fixed:', fullPath);
            }
        }
    }
}

processDir(path.resolve('./frontend/src'));
processDir(path.resolve('./backend/src'));
