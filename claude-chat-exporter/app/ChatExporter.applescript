-- Claude Chat Exporter – native Mini-App:
-- Session(s) auswählen → Format wählen → Export → im Finder zeigen.
--
-- __CLI_PATH__ wird von install.sh durch den echten Pfad ersetzt (Laufzeit-Kopie
-- unter ~/Library/Application Support/Claude Chat Exporter/cli.js).
property cliPath : "__CLI_PATH__"
property appTitle : "Claude Chat Exporter"
property allLabel : "▶ Alle Sessions exportieren (Ordner pro Projekt + INDEX.md)"
property nodeCandidates : {"/opt/homebrew/bin/node", "/usr/local/bin/node", "/opt/homebrew/opt/node/bin/node", "/usr/bin/node"}

on findNode()
	repeat with p in nodeCandidates
		set candidate to contents of p
		try
			do shell script "test -x " & quoted form of candidate
			return candidate
		end try
	end repeat
	try
		set found to do shell script "/bin/zsh -lc 'command -v node' 2>/dev/null"
		if found is not "" then return found
	end try
	return ""
end findNode

on showError(msg)
	display dialog msg buttons {"OK"} default button 1 with icon stop with title appTitle
end showError

on run
	set nodeBin to findNode()
	if nodeBin is "" then
		showError("Node.js wurde nicht gefunden." & return & return & "Bitte Node.js installieren (z. B. „brew install node“) und die App erneut starten.")
		return
	end if
	try
		do shell script "test -f " & quoted form of cliPath
	on error
		showError("Die Exporter-Dateien fehlen:" & return & cliPath & return & return & "Bitte install.sh aus dem Projektordner erneut ausführen.")
		return
	end try

	set tsv to ""
	try
		set tsv to do shell script quoted form of nodeBin & " " & quoted form of cliPath & " list --tsv --limit 50"
	on error errMsg
		showError("Konnte Sessions nicht laden:" & return & errMsg)
		return
	end try

	set labelList to {}
	set idList to {}
	repeat with ln in paragraphs of tsv
		set lineText to contents of ln
		if lineText is not "" then
			set AppleScript's text item delimiters to tab
			set parts to text items of lineText
			set AppleScript's text item delimiters to ""
			if (count of parts) is greater than or equal to 5 then
				set end of idList to item 1 of parts
				set end of labelList to (item 2 of parts) & "  ·  " & (item 4 of parts) & "  —  " & (item 5 of parts) & "  [" & (item 1 of parts) & "]"
			end if
		end if
	end repeat

	if (count of labelList) is 0 then
		display dialog "Keine Claude-Code-Sessions gefunden." buttons {"OK"} default button 1 with icon caution with title appTitle
		return
	end if

	set choice to choose from list ({allLabel} & labelList) with prompt "Welche Session(s) exportieren? (⌘-Klick für mehrere, neueste zuerst)" with title appTitle OK button name "Weiter" cancel button name "Abbrechen" with multiple selections allowed
	if choice is false then return
	set exportAll to (choice contains allLabel)

	set chosenIds to {}
	repeat with chosenLabel in choice
		repeat with i from 1 to count of labelList
			if item i of labelList is (contents of chosenLabel) then
				set end of chosenIds to item i of idList
				exit repeat
			end if
		end repeat
	end repeat
	if (not exportAll) and (count of chosenIds) is 0 then return

	set fmtChoice to choose from list {"Markdown", "PDF", "HTML", "Alle drei"} default items {"Markdown"} with prompt "In welches Format?" with title appTitle OK button name "Weiter" cancel button name "Abbrechen"
	if fmtChoice is false then return
	set fmtLabel to item 1 of fmtChoice
	set fmt to "markdown"
	if fmtLabel is "PDF" then set fmt to "pdf"
	if fmtLabel is "HTML" then set fmt to "html"
	if fmtLabel is "Alle drei" then set fmt to "all"

	set toolAnswer to button returned of (display dialog "Tool-Aktionen (Dateizugriffe, Websuchen …) als Protokoll-Notizen mit aufnehmen?" & return & return & "Empfohlen für BA-Dokumentation." buttons {"Abbrechen", "Ohne", "Mit Protokoll"} default button "Mit Protokoll" with title appTitle)
	if toolAnswer is "Abbrechen" then return

	if exportAll then
		set toolsArg to " --no-tools"
		if toolAnswer is "Mit Protokoll" then set toolsArg to ""
		try
			set indexPath to do shell script quoted form of nodeBin & " " & quoted form of cliPath & " export-all --format " & fmt & toolsArg & " 2>/dev/null"
		on error errMsg
			showError("Massen-Export fehlgeschlagen:" & return & errMsg)
			return
		end try
		set answer to button returned of (display dialog "Alle Sessions exportiert." & return & return & "Übersicht: " & indexPath buttons {"OK", "INDEX.md öffnen", "Im Finder zeigen"} default button "Im Finder zeigen" with title appTitle)
		if answer is "Im Finder zeigen" then
			do shell script "open -R " & quoted form of indexPath
		else if answer is "INDEX.md öffnen" then
			do shell script "open " & quoted form of indexPath
		end if
		return
	end if

	set toolsArg to ""
	if toolAnswer is "Mit Protokoll" then set toolsArg to " --tools"
	set outPaths to ""
	repeat with sid in chosenIds
		try
			set p to do shell script quoted form of nodeBin & " " & quoted form of cliPath & " export " & (contents of sid) & " --format " & fmt & toolsArg
			if outPaths is "" then
				set outPaths to p
			else
				set outPaths to outPaths & return & p
			end if
		on error errMsg
			showError("Export von Session " & (contents of sid) & " fehlgeschlagen:" & return & errMsg)
		end try
	end repeat
	if outPaths is "" then return

	set firstPath to paragraph 1 of outPaths
	set answer to button returned of (display dialog "Export gespeichert:" & return & return & outPaths buttons {"OK", "Öffnen", "Im Finder zeigen"} default button "Im Finder zeigen" with title appTitle)
	if answer is "Im Finder zeigen" then
		do shell script "open -R " & quoted form of firstPath
	else if answer is "Öffnen" then
		do shell script "open " & quoted form of firstPath
	end if
end run
