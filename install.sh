#!/usr/bin/env bash
set -euo pipefail

# OpenSentinel Installer
# Usage: curl -fsSL https://opensentinel.ai/install.sh | bash

BOLD="\033[1m"
GREEN="\033[32m"
CYAN="\033[36m"
YELLOW="\033[33m"
RESET="\033[0m"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║       OpenSentinel Installer             ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════╝${RESET}"
echo ""

OS="$(uname -s)"
ARCH="$(uname -m)"

echo -e "  System: ${BOLD}${OS} ${ARCH}${RESET}"
echo ""

# ── Step 1: Check/Install Bun ────────────────────────────────────────────────

if command -v bun &>/dev/null; then
  echo -e "  Bun: ${GREEN}$(bun --version)${RESET}"
else
  echo -e "  ${YELLOW}Installing Bun runtime...${RESET}"
  curl -fsSL https://bun.sh/install | bash
  export BUN_INSTALL="${HOME}/.bun"
  export PATH="${BUN_INSTALL}/bin:${PATH}"
  echo -e "  Bun: ${GREEN}$(bun --version)${RESET}"
fi

echo ""

# ── Step 2: Install OpenSentinel ─────────────────────────────────────────────

echo -e "  ${BOLD}Installing OpenSentinel...${RESET}"
bun install -g opensentinel@latest
echo -e "  ${GREEN}Installed.${RESET}"
echo ""

# ── Step 3: Run Setup Wizard ─────────────────────────────────────────────────

echo -e "  ${BOLD}Starting setup wizard...${RESET}"
echo ""
opensentinel setup
