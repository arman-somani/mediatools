const fs = require('fs');
const file = 'backend/src/routes/convert.ts';
let code = fs.readFileSync(file, 'utf8');

// Remove commented out fallback blocks
code = code.replace(/\/\*[\s\S]*?\/\/ API Tier 3\.5[\s\S]*?\*\//g, '');

// Remove the RapidAPI wrapper functions at the top of the file
const startIdx = code.indexOf('async function downloadAndMergeViaAPI');
const endFuncStr = 'async function downloadAndMergeViaQuickAPI';
const endIdxStart = code.indexOf(endFuncStr);

if (startIdx !== -1 && endIdxStart !== -1) {
    // Find the end of the last function
    let braceCount = 0;
    let endIdx = -1;
    let started = false;
    
    for (let i = endIdxStart; i < code.length; i++) {
        if (code[i] === '{') {
            braceCount++;
            started = true;
        } else if (code[i] === '}') {
            braceCount--;
            if (started && braceCount === 0) {
                endIdx = i + 1;
                break;
            }
        }
    }
    
    if (endIdx !== -1) {
        // Find the beginning of the comment block right before startIdx
        const chunkBefore = code.substring(0, startIdx);
        const commentStartIdx = chunkBefore.lastIndexOf('/**');
        
        const finalStart = commentStartIdx !== -1 ? commentStartIdx : startIdx;
        code = code.substring(0, finalStart) + code.substring(endIdx);
    }
}

fs.writeFileSync(file, code);
console.log('Cleanup complete');
