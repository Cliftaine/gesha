# Plantilla systemd (Linux). No editar a mano: `make service-install`
# sustituye @NODE@, @DIR@ y @USER@ y la instala en /etc/systemd/system/.
[Unit]
Description=Gesha — despachador de cartas Manta Café
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=@USER@
WorkingDirectory=@DIR@
ExecStart=@NODE@ server/index.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=PORT=3000
# Los datos son JSON en disco dentro del proyecto — sin permisos extra.
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
