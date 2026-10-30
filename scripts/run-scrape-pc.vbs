' Starts run-scrape-pc.ps1 with no window at all. Launching PowerShell directly
' (even with -WindowStyle Hidden) flashes a console window, and closing it kills
' the run (seen 2026-10-30: task result 0xC000013A). The Windows task runs this.
Set sh = CreateObject("WScript.Shell")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WScript.Quit sh.Run("powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & dir & "\run-scrape-pc.ps1""", 0, True)
