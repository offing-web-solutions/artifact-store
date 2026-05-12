SHELL        := /bin/bash
.PHONY: help install env start dev stop status logs \
        build _build-linux _build-linux-musl _build-macos _build-macos-x86_64 \
        checksums front-install front-dev clean release

ROOT           := $(shell pwd)
BACKEND_DIR    := $(ROOT)/backend
FRONTEND_DIR   := $(ROOT)/frontend
LOGS_DIR       := $(ROOT)/.logs
PYTHON_VERSION := 3.12.0
PORT           := 3008
DEBUG_PORT     := 5688
FRONT_PORT     := 5173

# ─── Docker image ──────────────────────────────────────────────────────────
# Sobreescribibles desde CLI: make build IMAGE=jordi/artifact-store TAG=v0.1.0
IMAGE          ?= artifact-store
VERSION        ?= $(shell sed -n 's/^version = "\(.*\)"/\1/p' $(BACKEND_DIR)/pyproject.toml | head -n1)
TAG            ?= $(if $(VERSION),$(VERSION),latest)
PLATFORMS      ?= linux/amd64,linux/arm64
DIST_DIR       ?= $(ROOT)/dist
BUILDFILE      ?= Dockerfile
VARIANT_LABEL  ?=
PYENV_ROOT     ?= $(HOME)/.pyenv
export PATH    := $(PYENV_ROOT)/bin:$(PYENV_ROOT)/shims:$(HOME)/.local/bin:$(PATH)

# Compatibilidad macOS / Linux / WSL
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
  PIDS_BY_PORT  = lsof -ti tcp:$$port 2>/dev/null | sort -u | tr '\n' ' '
  PID_BY_PORT   = lsof -ti tcp:$$port 2>/dev/null | head -1
else
  PIDS_BY_PORT  = ss -tlnp "sport = :$$port" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u | tr '\n' ' '
  PID_BY_PORT   = ss -tlnp "sport = :$$port" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1
endif

# Colores
RESET  := \033[0m
BOLD   := \033[1m
GREEN  := \033[0;32m
RED    := \033[0;31m
DIM    := \033[2m

# Badges
BADGE  := \033[1;30;48;5;180m back  \033[0m
FBADGE := \033[1;30;48;5;35m front \033[0m

$(LOGS_DIR):
	@mkdir -p $(LOGS_DIR)

## Muestra esta ayuda
help:
	@printf "\n"
	@printf "  \033[0;32m █████╗ ██████╗ ████████╗██╗███████╗ █████╗  ██████╗████████╗\033[0m\n"
	@printf "  \033[0;32m██╔══██╗██╔══██╗╚══██╔══╝██║██╔════╝██╔══██╗██╔════╝╚══██╔══╝\033[0m\n"
	@printf "  \033[0;32m███████║██████╔╝   ██║   ██║█████╗  ███████║██║        ██║   \033[0m\n"
	@printf "  \033[0;32m██╔══██║██╔══██╗   ██║   ██║██╔══╝  ██╔══██║██║        ██║   \033[0m\n"
	@printf "  \033[0;32m██║  ██║██║  ██║   ██║   ██║██║     ██║  ██║╚██████╗   ██║   \033[0m\n"
	@printf "  \033[0;32m╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝╚═╝     ╚═╝  ╚═╝ ╚═════╝   ╚═╝   \033[0m\n"
	@printf "\n"
	@printf "  \033[1mArtifact Store\033[0m  \033[2mPython $(PYTHON_VERSION)  ·  FastAPI  ·  :$(PORT)\033[0m\n"
	@printf "\n"
	@printf "  \033[2m─────────────────────────────────────────\033[0m\n"
	@printf "\n"
	@printf "  \033[1minstall\033[0m         \033[2mpyenv · poetry · pnpm · dependencias  (omite lo instalado)\033[0m\n"
	@printf "  \033[1mstart o dev\033[0m     \033[2marranca backend :$(PORT) + frontend dev :$(FRONT_PORT)\033[0m  \033[2m(alias: dev)\033[0m\n"
	@printf "\n"
	@printf "  \033[2m─────────────────────────────────────────\033[0m\n"
	@printf "\n"
	@printf "  \033[1mstatus\033[0m          \033[2mestado del backend y del dev server\033[0m\n"
	@printf "  \033[1mlogs\033[0m            \033[2mlogs en tiempo real (tail -f)\033[0m\n"
	@printf "  \033[1mstop\033[0m            \033[2mpara backend + frontend dev server\033[0m\n"
	@printf "  \033[1mclean\033[0m           \033[2melimina .logs · dist · artefactos temporales\033[0m\n"
	@printf "\n"
	@printf "  \033[2m─────────────────────────────────────────\033[0m\n"
	@printf "\n"
	@printf "  \033[1mbuild\033[0m       \033[2m5 Linux Docker + 2 macOS PyInstaller → tarballs en dist/  (patrón make package-all de dock-sight)\033[0m\n"
	@printf "  \033[1mchecksums\033[0m   \033[2mgenera dist/checksums.txt (SHA256)\033[0m\n"
	@printf "\n"
	@printf "  \033[2m   make build PUSH=1 IMAGE=jordi/artifact-store TAG=v$(VERSION)  →  publica al registry\033[0m\n"
	@printf "\n"

## Instala todas las dependencias del proyecto
install: env front-install
	@echo ""
	@printf "  \033[1mInstalando dependencias\033[0m\n"
	@echo ""
	@if [ ! -d $(BACKEND_DIR)/.venv ]; then \
		printf "  $(BADGE)  \033[2mconfigurando entorno Python $(PYTHON_VERSION)...\033[0m\n\n"; \
		pyenv install $(PYTHON_VERSION) --skip-existing; \
		$(PYENV_ROOT)/versions/$(PYTHON_VERSION)/bin/python3.12 -m venv $(BACKEND_DIR)/.venv; \
		VIRTUAL_ENV=$(BACKEND_DIR)/.venv PATH=$(BACKEND_DIR)/.venv/bin:$$PATH poetry -C $(BACKEND_DIR) install --no-root --quiet; \
		echo ""; \
	else \
		if [ $(BACKEND_DIR)/poetry.lock -nt $(BACKEND_DIR)/.venv ] 2>/dev/null || [ $(BACKEND_DIR)/pyproject.toml -nt $(BACKEND_DIR)/.venv ]; then \
			printf "  $(BADGE)  \033[2mactualizando dependencias...\033[0m\n\n"; \
			VIRTUAL_ENV=$(BACKEND_DIR)/.venv PATH=$(BACKEND_DIR)/.venv/bin:$$PATH poetry -C $(BACKEND_DIR) install --no-root --quiet; \
			touch $(BACKEND_DIR)/.venv; \
			echo ""; \
		else \
			printf "  $(BADGE)  \033[2mok\033[0m\n"; \
		fi \
	fi
	@echo ""

## Instala las dependencias del frontend (pnpm)
front-install:
	@if [ ! -d $(FRONTEND_DIR)/node_modules ] || [ $(FRONTEND_DIR)/package.json -nt $(FRONTEND_DIR)/node_modules ]; then \
		printf "\n  $(FBADGE)  \033[2minstalando dependencias del frontend...\033[0m\n\n"; \
		cd $(FRONTEND_DIR) && pnpm install --silent; \
		echo ""; \
	else \
		printf "  $(FBADGE)  \033[2mok\033[0m\n"; \
	fi

## Genera backend/.env.local con secretos aleatorios si no existe
env:
	@if [ ! -f $(BACKEND_DIR)/.env.local ]; then \
		printf "\n  $(BADGE)  \033[2mgenerando backend/.env.local con secretos aleatorios...\033[0m\n"; \
		mkdir -p $(ROOT)/data; \
		SIGNING_SECRET=$$(openssl rand -hex 32); \
		{ \
			echo "ENVIRONMENT=local"; \
			echo "ALLOWED_ORIGINS=*"; \
			echo "ROOT_PATH="; \
			echo ""; \
			echo "# Directorio local donde se guardan los archivos (no se versiona)"; \
			echo "STORAGE_PATH=$(ROOT)/data"; \
			echo ""; \
			echo "# Secreto para firmar URLs temporales (HMAC-SHA256)"; \
			echo "SIGNING_SECRET=$$SIGNING_SECRET"; \
			echo ""; \
			echo "PUBLIC_BASE_URL=http://localhost:$(PORT)"; \
			echo "DEFAULT_EXPIRES_IN=3600"; \
		} > $(BACKEND_DIR)/.env.local; \
		printf "  $(BADGE)  \033[0;32m.env.local creado\033[0m  \033[2mSTORAGE_PATH=$(ROOT)/data\033[0m\n"; \
	fi

## Arranca backend (:$(PORT)) y frontend dev server (:$(FRONT_PORT))
start dev: $(LOGS_DIR) env
	@echo ""
	@port=$(PORT); pid=$$($(PID_BY_PORT)); \
	if [ -n "$$pid" ]; then \
		printf "  $(BADGE)  \033[0;33mya activo\033[0m  \033[2mPID $$pid  :$(PORT)\033[0m\n"; \
	else \
		printf "  $(BADGE)  \033[2mhttp://localhost:$(PORT)\033[0m\n"; \
		( cd $(BACKEND_DIR) && .venv/bin/uvicorn app.main:app --reload --port $(PORT) > $(LOGS_DIR)/artifact-store.log 2>&1 ) & \
		echo $$! > $(LOGS_DIR)/artifact-store.pid; \
	fi
	@port=$(FRONT_PORT); pid=$$($(PID_BY_PORT)); \
	if [ -n "$$pid" ]; then \
		printf "  $(FBADGE)  \033[0;33mya activo\033[0m  \033[2mPID $$pid  :$(FRONT_PORT)\033[0m\n"; \
	else \
		printf "  $(FBADGE)  \033[2mhttp://localhost:$(FRONT_PORT)\033[0m\n"; \
		( cd $(FRONTEND_DIR) && pnpm dev --port $(FRONT_PORT) > $(LOGS_DIR)/frontend.log 2>&1 ) & \
		echo $$! > $(LOGS_DIR)/frontend.pid; \
	fi
	@echo ""
	@printf "  $(DIM)make logs · make stop · make build (para servir desde :$(PORT))$(RESET)\n"
	@echo ""

## Arranca solo el frontend dev server
front-dev: $(LOGS_DIR)
	cd $(FRONTEND_DIR) && pnpm dev --port $(FRONT_PORT)

## Construye TODOS los artefactos: 3 imágenes Docker Linux (glibc) + 2 Alpine
## (musl) + (si estás en Mac) un binario nativo macOS con PyInstaller.
## Cada uno queda como tarball en dist/.
##
##   make build                     → todos los artefactos en dist/
##   make build PUSH=1 IMAGE=...    → push imagen Docker multi-arch al registry
##                                    (linux/amd64+arm64 glibc, sin tarballs locales)
build:
ifdef PUSH
	@printf "\n  \033[1mPush Docker image\033[0m  \033[2m$(IMAGE):$(TAG)  ·  $(PLATFORMS)\033[0m\n\n"
	@docker buildx build -f $(BUILDFILE) \
		--platform $(PLATFORMS) \
		-t $(IMAGE):$(TAG) \
		-t $(IMAGE):latest \
		--push \
		.
	@printf "\n  \033[0;32m✓ Pushed\033[0m  \033[2m$(IMAGE):$(TAG)\033[0m\n\n"
else
	@$(MAKE) --no-print-directory _build-linux      PLATFORMS=linux/amd64,linux/arm64,linux/arm/v7
	@$(MAKE) --no-print-directory _build-linux-musl PLATFORMS=linux/amd64,linux/arm64
	@if [ "$$(uname -s)" = "Darwin" ]; then \
		$(MAKE) --no-print-directory _build-macos; \
		$(MAKE) --no-print-directory _build-macos-x86_64; \
	else \
		printf "\n  $(DIM)(skipping macOS binaries: no estás en una Mac · dock-sight tampoco genera estos sin macOS)$(RESET)\n"; \
	fi
	@echo ""
	@printf "  $(DIM)docker load -i dist/<archivo>.tar.gz · make checksums$(RESET)\n"
	@echo ""
endif

# ── Internal: build Linux Docker images (glibc) ────────────────────────────
_build-linux:
	@mkdir -p $(DIST_DIR)
	@for plat in $$(echo "$(PLATFORMS)" | tr ',' ' '); do \
		label=$$(echo "$$plat" | sed 's|^linux/||; s|/||g'); \
		out="$(DIST_DIR)/$(notdir $(IMAGE))-linux-$${label}.tar"; \
		printf "\n  \033[1mBuild\033[0m  \033[2m$(IMAGE):$(TAG)  ·  $${plat}  ·  Dockerfile\033[0m\n\n"; \
		docker buildx build -f Dockerfile --platform $${plat} \
			-t $(IMAGE):$(TAG) -t $(IMAGE):latest \
			--output "type=docker,dest=$${out}" . || exit 1; \
		gzip -f "$${out}"; \
		size=$$(du -h "$${out}.gz" | cut -f1); \
		printf "  \033[0;32m✓\033[0m  \033[2m$${out}.gz  ($${size})\033[0m\n"; \
	done

# ── Internal: build Linux Docker images (musl/Alpine) ──────────────────────
# armv7-musl se omite: cryptography (dep transitiva de poetry) no tiene wheel
# musllinux para armv7 y la toolchain Rust no soporta esa target.
_build-linux-musl:
	@mkdir -p $(DIST_DIR)
	@for plat in $$(echo "$(PLATFORMS)" | tr ',' ' '); do \
		label=$$(echo "$$plat" | sed 's|^linux/||; s|/||g'); \
		out="$(DIST_DIR)/$(notdir $(IMAGE))-linux-$${label}-musl.tar"; \
		printf "\n  \033[1mBuild\033[0m  \033[2m$(IMAGE):$(TAG)  ·  $${plat}  ·  musl/Alpine\033[0m\n\n"; \
		docker buildx build -f Dockerfile.alpine --platform $${plat} \
			-t $(IMAGE):$(TAG) -t $(IMAGE):latest \
			--output "type=docker,dest=$${out}" . || exit 1; \
		gzip -f "$${out}"; \
		size=$$(du -h "$${out}.gz" | cut -f1); \
		printf "  \033[0;32m✓\033[0m  \033[2m$${out}.gz  ($${size})\033[0m\n"; \
	done

# ── Internal: macOS native binary (PyInstaller) ────────────────────────────
# Equivalente al "rustup native" que usa dock-sight para macos-*: no Docker,
# se ejecuta directamente en la Mac. Solo produce la arch del host
# (Apple Silicon → arm64). Binario sin firma → Gatekeeper avisará.
_build-macos:
	@arch_raw=$$(uname -m); \
	if [ "$$arch_raw" = "x86_64" ]; then arch=amd64; else arch=$$arch_raw; fi; \
	printf "\n  \033[1mBuild\033[0m  \033[2m$(IMAGE):$(TAG)  ·  macos-$$arch  ·  PyInstaller\033[0m\n\n"; \
	mkdir -p $(DIST_DIR); \
	printf "  $(FBADGE)  \033[2mbuilding frontend...\033[0m\n"; \
	cd $(FRONTEND_DIR) && pnpm build > /dev/null; \
	printf "  $(BADGE)  \033[2minstalling pyinstaller en .venv...\033[0m\n"; \
	$(BACKEND_DIR)/.venv/bin/pip install -q 'pyinstaller>=6.0,<7.0'; \
	printf "  $(BADGE)  \033[2mempaquetando...\033[0m\n\n"; \
	rm -rf $(BACKEND_DIR)/build $(BACKEND_DIR)/dist $(BACKEND_DIR)/artifact-store.spec; \
	cd $(BACKEND_DIR) && .venv/bin/pyinstaller --clean --noconfirm \
		--onefile --name artifact-store \
		--paths . --collect-submodules app --collect-submodules config \
		--add-data "$(FRONTEND_DIR)/dist:frontend/dist" \
		--hidden-import uvicorn.lifespan.on \
		--hidden-import uvicorn.lifespan.off \
		--hidden-import uvicorn.protocols.http.auto \
		--hidden-import uvicorn.protocols.http.h11_impl \
		--hidden-import uvicorn.protocols.http.httptools_impl \
		--hidden-import uvicorn.protocols.websockets.auto \
		--hidden-import uvicorn.protocols.websockets.websockets_impl \
		--hidden-import uvicorn.loops.auto \
		--hidden-import uvicorn.loops.uvloop \
		scripts/run.py > /dev/null; \
	out=$(DIST_DIR)/$(notdir $(IMAGE))-macos-$$arch.tar.gz; \
	tar -czf $$out -C $(BACKEND_DIR)/dist artifact-store; \
	rm -rf $(BACKEND_DIR)/build $(BACKEND_DIR)/dist $(BACKEND_DIR)/artifact-store.spec; \
	size=$$(du -h $$out | cut -f1); \
	printf "  \033[0;32m✓\033[0m  \033[2m$$out  ($$size)\033[0m\n"

# ── Internal: macOS x86_64 binary (PyInstaller bajo Rosetta) ───────────────
# Requiere Rosetta 2 + un Python 3.12 x86_64. Si falta cualquiera de los dos,
# se omite con mensaje informativo (no rompe el build). dock-sight resuelve
# esto cross-compilando con rustup; en Python esa cross-compilation no existe.
_build-macos-x86_64:
	@if ! arch -x86_64 true 2>/dev/null; then \
		printf "\n  $(DIM)(skipping macos-amd64: Rosetta no instalado — softwareupdate --install-rosetta)$(RESET)\n"; exit 0; \
	fi
	@py=""; for cand in $$HOME/.pyenv/versions/3.12-x86_64/bin/python3 $$HOME/.pyenv/versions/3.12.0-x86_64/bin/python3 /usr/local/bin/python3.12; do \
		if [ -x "$$cand" ] && file "$$cand" 2>/dev/null | grep -q x86_64; then py="$$cand"; break; fi; \
	done; \
	if [ -z "$$py" ]; then \
		printf "\n  $(DIM)(skipping macos-amd64: no hay Python 3.12 x86_64 instalado — ver README)$(RESET)\n"; \
		exit 0; \
	fi; \
	printf "\n  \033[1mBuild\033[0m  \033[2m$(IMAGE):$(TAG)  ·  macos-amd64  ·  PyInstaller bajo Rosetta\033[0m\n\n"; \
	mkdir -p $(DIST_DIR); \
	printf "  $(FBADGE)  \033[2mbuilding frontend...\033[0m\n"; \
	cd $(FRONTEND_DIR) && pnpm build > /dev/null; \
	venv=$(BACKEND_DIR)/.venv-x86_64; \
	printf "  $(BADGE)  \033[2mcreando venv x86_64 + instalando deps...\033[0m\n"; \
	rm -rf $$venv; \
	arch -x86_64 $$py -m venv $$venv; \
	arch -x86_64 $$venv/bin/pip install -q --upgrade pip; \
	arch -x86_64 $$venv/bin/pip install -q poetry==1.8.3 'pyinstaller>=6.0,<7.0'; \
	arch -x86_64 $$venv/bin/poetry -C $(BACKEND_DIR) install --only main --no-root -q; \
	printf "  $(BADGE)  \033[2mempaquetando...\033[0m\n\n"; \
	rm -rf $(BACKEND_DIR)/build $(BACKEND_DIR)/dist $(BACKEND_DIR)/artifact-store.spec; \
	cd $(BACKEND_DIR) && arch -x86_64 .venv-x86_64/bin/pyinstaller --clean --noconfirm \
		--onefile --name artifact-store \
		--paths . --collect-submodules app --collect-submodules config \
		--add-data "$(FRONTEND_DIR)/dist:frontend/dist" \
		--hidden-import uvicorn.lifespan.on \
		--hidden-import uvicorn.lifespan.off \
		--hidden-import uvicorn.protocols.http.auto \
		--hidden-import uvicorn.protocols.http.h11_impl \
		--hidden-import uvicorn.protocols.http.httptools_impl \
		--hidden-import uvicorn.protocols.websockets.auto \
		--hidden-import uvicorn.protocols.websockets.websockets_impl \
		--hidden-import uvicorn.loops.auto \
		--hidden-import uvicorn.loops.uvloop \
		scripts/run.py > /dev/null; \
	out=$(DIST_DIR)/$(notdir $(IMAGE))-macos-amd64.tar.gz; \
	tar -czf $$out -C $(BACKEND_DIR)/dist artifact-store; \
	rm -rf $(BACKEND_DIR)/build $(BACKEND_DIR)/dist $(BACKEND_DIR)/artifact-store.spec; \
	size=$$(du -h $$out | cut -f1); \
	printf "  \033[0;32m✓\033[0m  \033[2m$$out  ($$size)\033[0m\n"

## Genera SHA256 de los tarballs en dist/
checksums:
	@if [ ! -d "$(DIST_DIR)" ] || [ -z "$$(ls $(DIST_DIR)/*.tar.gz 2>/dev/null)" ]; then \
		echo ""; printf "  \033[0;31m✗ No hay .tar.gz en $(DIST_DIR)\033[0m\n"; echo ""; exit 1; \
	fi
	@cd $(DIST_DIR) && shasum -a 256 *.tar.gz > checksums.txt
	@printf "\n  \033[0;32m✓\033[0m  \033[2m$(DIST_DIR)/checksums.txt\033[0m\n"
	@cat $(DIST_DIR)/checksums.txt | awk '{printf "  \033[2m%s  %s\033[0m\n", $$1, $$2}'
	@echo ""

## Para el servicio
stop:
	@echo ""
	@printf "  \033[1mParando servicio\033[0m\n"
	@echo ""
	@{ \
	_kill() { \
		port=$$1; badge="$$2"; \
		pids=$$($(PIDS_BY_PORT)); \
		if [ -n "$$pids" ]; then \
			echo "$$pids" | xargs kill 2>/dev/null; \
			sleep 0.3; \
			remaining=$$($(PIDS_BY_PORT)); \
			if [ -z "$$remaining" ]; then \
				printf "  $$badge  \033[0;32m parado\033[0m\n"; \
			else \
				echo "$$remaining" | xargs kill -9 2>/dev/null; \
				printf "  $$badge  \033[0;32m parado\033[0m  \033[2m(forzado)\033[0m\n"; \
			fi; \
		else \
			printf "  $$badge  \033[2m inactivo\033[0m\n"; \
		fi; \
	}; \
	_kill $(PORT)       "$(BADGE)"; \
	_kill $(DEBUG_PORT) "" 2>/dev/null; \
	_kill $(FRONT_PORT) "$(FBADGE)"; \
	} 2>/dev/null
	@rm -f $(LOGS_DIR)/*.pid
	@echo ""

## Muestra el estado de los servicios
status:
	@echo ""
	@printf "  \033[1mEstado de los servicios\033[0m\n"
	@echo ""
	@for entry in "$(PORT):$(BADGE)" "$(FRONT_PORT):$(FBADGE)"; do \
		port=$$(echo "$$entry" | cut -d: -f1); \
		badge=$$(echo "$$entry" | cut -d: -f2-); \
		pid=$$($(PID_BY_PORT)); \
		if [ -n "$$pid" ]; then \
			printf "  $$badge  \033[0;32m activo\033[0m   \033[2mPID $$pid  :$$port\033[0m\n"; \
		else \
			printf "  $$badge  \033[2m inactivo\033[0m\n"; \
		fi; \
	done
	@echo ""

## Muestra los logs en tiempo real (backend + frontend)
logs:
	@if [ ! -f $(LOGS_DIR)/artifact-store.log ] && [ ! -f $(LOGS_DIR)/frontend.log ]; then \
		echo ""; echo "  No hay logs disponibles. Ejecuta 'make start' primero."; echo ""; exit 1; \
	fi
	@echo ""
	@printf "  \033[1mLogs\033[0m  \033[2mCtrl+C para salir\033[0m\n"
	@echo ""
	@_tail() { tail -n 50 -f "$$1" 2>/dev/null | awk -v b="$$2" '{"date +%H:%M:%S" | getline t; close("date +%H:%M:%S"); print "  " b "  \033[2m[" t "]\033[0m  " $$0; fflush()}'; }; \
	trap 'kill 0' INT; \
	[ -f $(LOGS_DIR)/artifact-store.log ] && _tail $(LOGS_DIR)/artifact-store.log "$(BADGE)" & \
	[ -f $(LOGS_DIR)/frontend.log ]       && _tail $(LOGS_DIR)/frontend.log       "$(FBADGE)" & \
	wait

## Limpia logs, build del frontend, dist/ y artefactos temporales
clean:
	@rm -rf $(LOGS_DIR) $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/.vite $(DIST_DIR)
	@find $(BACKEND_DIR) -type d -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true
	@find $(BACKEND_DIR) -type d -name .pytest_cache -prune -exec rm -rf {} + 2>/dev/null || true
	@echo ""
	@printf "  \033[0;32m✓ Limpio\033[0m\n"
	@echo ""
