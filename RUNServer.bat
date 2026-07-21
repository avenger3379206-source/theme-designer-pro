@ECHO OFF
REM
REM
REM
REM         
REM  
REM
REM

ECHO **********************************
ECHO *                                *
ECHO *   Running Monitoring Server    *
ECHO *                                *
ECHO **********************************
ECHO         
ECHO

CD C:\1\gamenet-watcher-main
$env:MIKROTIK_HOST="192.168.3.200"
$env:MIKROTIK_USER="exir-agent"
$env:MIKROTIK_PASS="#22302791B#"
npm run dev


REM  npm run build
REM  npm start




REM  name=Av
REM  password=#22302791B#3379
REM  group=full