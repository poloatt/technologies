Set-Location C:\Users\polo\attadia\apps\backend
node --input-type=module -e import('../shared/habits/index.js').then(() => console.log('IMPORT_OK')).catch(e => { console.error('IMPORT_FAIL', e.message); process.exit(1); })
Write-Output (EXIT: + $LASTEXITCODE)
