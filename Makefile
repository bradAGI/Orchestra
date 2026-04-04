
.PHONY: backend dash build install desktop

backend:
	@cd apps/backend && GOCACHE=/tmp/go-build-cache go build -o orchestrad ./cmd/orchestrad

dash: backend
	@cd apps/tui && go run .

build:
	@cd apps/tui && go build -o ../../orchestra-dash .

install:
	@cd apps/tui && go build -o /usr/local/bin/orchestra-dash .
	@echo "Orchestra Dashboard installed to /usr/local/bin/orchestra-dash"

desktop: # dev-only: --no-sandbox bypasses Chromium SUID sandbox (not for production)
	@cd apps/desktop && npm run dev:linux
