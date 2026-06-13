import { Router } from 'express';
import { execSync } from 'child_process';

const router = Router();

/**
 * GET /engine/installed
 * Returns { installed: boolean }
 */
router.get('/installed', (_req, res) => {
    try {
        // Query the registry key set by the .bat installer
        const output = execSync(
            'reg query "HKLM\\Software\\MediaToolsEngine" /v Installed',
            { encoding: 'utf8' }
        );
        const installed = /REG_DWORD\s+0x1/.test(output);
        res.json({ installed });
    } catch {
        // If the query fails (key missing) we assume not installed
        res.json({ installed: false });
    }
});

export default router;
