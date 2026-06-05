$path = 'D:\WEBSITE\MEDIATOOLS\frontend\src\app\dashboard\page.tsx'
$bytes = [System.IO.File]::ReadAllBytes($path)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

# The garbled sequence is the UTF-8 bytes for U+2192 (→) read as Latin-1
# U+2192 in UTF-8 = 0xE2 0x86 0x92
# When mis-read as Latin-1/Windows-1252, those become: â (E2) † (86→ dagger) ' (92→ right single quote)
# But the actual file bytes are correct UTF-8 for →, the display is just misleading
# Let's check what's actually in the file around label:

$idx = $content.IndexOf("label: '")
Write-Host "Found 'label:' at index $idx"
Write-Host "Chars around it:"
for ($i = $idx; $i -lt [Math]::Min($idx + 60, $content.Length); $i++) {
    $c = $content[$i]
    Write-Host "  [$i] U+$([int]$c) '$c'"
}
