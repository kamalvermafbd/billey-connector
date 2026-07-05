#define MyAppName "Billey Connector"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Billey"
#define MyAppExeName "node.exe"

[Setup]
AppId={{BILLEY-CONNECTOR}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Billey Connector
DefaultGroupName=Billey Connector
OutputDir=build
OutputBaseFilename=BilleyConnectorSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\runtime\node\*"; DestDir: "{app}\runtime\node"; Flags: recursesubdirs createallsubdirs
Source: "..\dist\*"; DestDir: "{app}\dist"; Flags: recursesubdirs createallsubdirs
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\run.bat"; DestDir: "{app}"; Flags: ignoreversion

[Tasks]
Name: "desktopicon"; Description: "Create a Desktop Shortcut"; GroupDescription: "Additional icons:"

[Icons]
Name: "{group}\Billey Connector"; Filename: "{app}\run.bat"
Name: "{commondesktop}\Billey Connector"; Filename: "{app}\run.bat"

[Run]
Filename: "{app}\run.bat"; Flags: nowait postinstall skipifsilent
