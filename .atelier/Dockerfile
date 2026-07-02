FROM atelier-workspace
# Atelier image version: 1
# Repo VS Code extensions image version: 1

# Install repository-specific VS Code extensions into Atelier's shared extension dir.
# Keep this in sync with .vscode/extensions.json so VS Code users also see
# workspace recommendations, and so Atelier can later use those recommendations
# as signals when generating repository Dockerfiles automatically.
RUN set -eux; \
  chown -R atelier:atelier /opt/atelier/vscode-extensions; \
  CODE_SERVER="$(find /home/atelier/.vscode/cli/serve-web -path '*/bin/code-server' -type f | head -n 1)"; \
  su atelier -c "\"$CODE_SERVER\" --extensions-dir /opt/atelier/vscode-extensions --install-extension ms-vscode.vscode-typescript-next --force"; \
  su atelier -c "\"$CODE_SERVER\" --extensions-dir /opt/atelier/vscode-extensions --install-extension slevesque.shader --force"
