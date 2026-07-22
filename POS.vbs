Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

basePath = fso.GetParentFolderName(WScript.ScriptFullName)

' Crear acceso directo en escritorio si no existe
desktopPath = shell.SpecialFolders("Desktop")
shortcutPath = desktopPath & "\POS Recaudo.lnk"
If Not fso.FileExists(shortcutPath) Then
    Set shortcut = shell.CreateShortCut(shortcutPath)
    shortcut.TargetPath = basePath & "\POS.vbs"
    shortcut.WorkingDirectory = basePath
    shortcut.Description = "POS Recaudo"
    shortcut.Save
End If

' Verificar Node.js
Set nodeCheck = shell.Exec("cmd /c where node")
nodeOutput = nodeCheck.StdOut.ReadAll
If Len(Trim(nodeOutput)) = 0 Then
    MsgBox "Node.js no esta instalado." & vbCrLf & "Descarga desde: https://nodejs.org", vbExclamation, "POS Recaudo"
    WScript.Quit
End If

' Verificar dependencias
If Not fso.FolderExists(basePath & "\node_modules") Then
    Set npmProc = shell.Exec("cmd /c cd /d """ & basePath & """ && npm install")
    Do While npmProc.Status = 0
        WScript.Sleep 1000
    Loop
End If

' Iniciar servidor
Set nodeProc = shell.Exec("cmd /c cd /d """ & basePath & """ && node server.js")

WScript.Sleep 2000

shell.Run "http://localhost:3000"

Do While True
    WScript.Sleep 3000
    found = False
    For Each proc In GetObject("winmgmts:").ExecQuery("Select Name from Win32_Process Where Name = 'chrome.exe' Or Name = 'msedge.exe' Or Name = 'firefox.exe' Or Name = 'opera.exe'")
        found = True
        Exit For
    Next
    If Not found Then Exit Do
Loop

On Error Resume Next
shell.Exec "cmd /c taskkill /f /im node.exe"
WScript.Quit
