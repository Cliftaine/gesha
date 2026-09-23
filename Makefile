# Gesha — despachador de cartas Manta Café
# Uso rápido:
#   make setup            # primera vez: dependencias + build del panel + isotipos
#   make start            # correr en foreground
#   make service-install  # instalar como servicio del sistema (arranca al boot,
#                         # se reinicia solo si se cae). Detecta macOS/Linux.
#   make service-status | service-logs | service-restart | service-uninstall

PROJECT_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
NODE        := $(shell command -v node)
USER_NAME   := $(shell whoami)
UNAME       := $(shell uname -s)

# macOS → launchd (LaunchAgent del usuario); Linux → systemd (requiere sudo).
PLIST_LABEL := com.mantacafe.gesha
PLIST_DEST  := $(HOME)/Library/LaunchAgents/$(PLIST_LABEL).plist
UNIT_DEST   := /etc/systemd/system/gesha.service

.PHONY: setup build start dev isotipos panel-build \
        service-install service-uninstall service-status service-logs service-restart

## ── Proyecto ───────────────────────────────────────────────────────────────

setup:
	npm install
	npm --prefix panel install
	npm run seed
	$(MAKE) build

build: panel-build isotipos

panel-build:
	npm --prefix panel run build

isotipos:
	node scripts/build-isotipos.js

start:
	NODE_ENV=production node server/index.js

dev:
	node --watch server/index.js

## ── Servicio del sistema ───────────────────────────────────────────────────

service-install: build
ifeq ($(UNAME),Darwin)
	@mkdir -p $(PROJECT_DIR)/logs $(HOME)/Library/LaunchAgents
	@sed -e 's|@NODE@|$(NODE)|g' -e 's|@DIR@|$(PROJECT_DIR)|g' \
		deploy/$(PLIST_LABEL).plist.tpl > $(PLIST_DEST)
	@plutil -lint $(PLIST_DEST)
	-launchctl bootout gui/$$(id -u)/$(PLIST_LABEL) 2>/dev/null || true
	launchctl bootstrap gui/$$(id -u) $(PLIST_DEST)
	@echo "✓ Servicio launchd instalado: arranca al iniciar sesión y se reinicia solo."
	@echo "  Logs: make service-logs"
else
	@sed -e 's|@NODE@|$(NODE)|g' -e 's|@DIR@|$(PROJECT_DIR)|g' -e 's|@USER@|$(USER_NAME)|g' \
		deploy/gesha.service.tpl | sudo tee $(UNIT_DEST) > /dev/null
	sudo systemctl daemon-reload
	sudo systemctl enable --now gesha
	@echo "✓ Servicio systemd instalado y habilitado: arranca con el servidor."
	@echo "  Logs: make service-logs"
endif

service-uninstall:
ifeq ($(UNAME),Darwin)
	-launchctl bootout gui/$$(id -u)/$(PLIST_LABEL) 2>/dev/null || true
	rm -f $(PLIST_DEST)
	@echo "✓ Servicio launchd eliminado."
else
	-sudo systemctl disable --now gesha
	sudo rm -f $(UNIT_DEST)
	sudo systemctl daemon-reload
	@echo "✓ Servicio systemd eliminado."
endif

service-status:
ifeq ($(UNAME),Darwin)
	@launchctl print gui/$$(id -u)/$(PLIST_LABEL) 2>/dev/null | grep -E 'state|pid|last exit' \
		|| echo "servicio no instalado / no corriendo"
	@curl -sf -o /dev/null localhost:3000/api/resolve/centro/pantalla_1 \
		&& echo "HTTP: respondiendo ✓" || echo "HTTP: sin respuesta ✗"
else
	systemctl status gesha --no-pager || true
endif

service-logs:
ifeq ($(UNAME),Darwin)
	tail -f logs/gesha.log logs/gesha.err.log
else
	journalctl -u gesha -f
endif

service-restart:
ifeq ($(UNAME),Darwin)
	launchctl kickstart -k gui/$$(id -u)/$(PLIST_LABEL)
else
	sudo systemctl restart gesha
endif
