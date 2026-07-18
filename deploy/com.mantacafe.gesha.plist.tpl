<?xml version="1.0" encoding="UTF-8"?>
<!-- Plantilla launchd (macOS). No editar a mano: `make service-install`
     sustituye @NODE@ y @DIR@ y la instala en ~/Library/LaunchAgents/. -->
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.mantacafe.gesha</string>
  <key>ProgramArguments</key>
  <array>
    <string>@NODE@</string>
    <string>server/index.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>@DIR@</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>PORT</key>
    <string>3000</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>@DIR@/logs/gesha.log</string>
  <key>StandardErrorPath</key>
  <string>@DIR@/logs/gesha.err.log</string>
</dict>
</plist>
