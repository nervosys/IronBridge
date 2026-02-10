# Installation

## From crates.io (Recommended)

```bash
cargo install chasm
```

Verify the installation:

```bash
chasm --version
```

## From Source

```bash
git clone https://github.com/nervosys/chasm.git
cd chasm/chasm-rust
cargo install --path .
```

## Pre-built Binaries

Download from [GitHub Releases](https://github.com/nervosys/chasm/releases):

| Platform | Architecture | Download |
|---|---|---|
| Windows | x86_64 | [chasm-windows-x64.zip](https://github.com/nervosys/chasm/releases/latest) |
| macOS | x86_64 | [chasm-darwin-x64.tar.gz](https://github.com/nervosys/chasm/releases/latest) |
| macOS | aarch64 | [chasm-darwin-arm64.tar.gz](https://github.com/nervosys/chasm/releases/latest) |
| Linux | x86_64 | [chasm-linux-x64.tar.gz](https://github.com/nervosys/chasm/releases/latest) |
| Linux | aarch64 | [chasm-linux-arm64.tar.gz](https://github.com/nervosys/chasm/releases/latest) |

### Installing from Binary

=== "Windows"

    ```powershell
    # Extract and add to PATH
    Expand-Archive chasm-windows-x64.zip -DestinationPath $env:LOCALAPPDATA\chasm
    $env:PATH += ";$env:LOCALAPPDATA\chasm"
    ```

=== "macOS / Linux"

    ```bash
    tar xzf chasm-*.tar.gz
    sudo mv chasm /usr/local/bin/
    ```

## Docker

```bash
docker pull ghcr.io/nervosys/chasm:latest
docker run -v ~/.chasm:/data ghcr.io/nervosys/chasm list workspaces
```

## Platform Notes

=== "Windows"

    - Requires Windows 10 or later
    - VS Code workspace storage: `%APPDATA%\Code\User\workspaceStorage\`
    - Database location: `%LOCALAPPDATA%\csm\csm.db`

=== "macOS"

    - Requires macOS 12 (Monterey) or later
    - Apple Silicon (M1/M2/M3/M4) supported natively
    - VS Code workspace storage: `~/Library/Application Support/Code/User/workspaceStorage/`
    - Database location: `~/Library/Application Support/csm/csm.db`

=== "Linux"

    - Requires glibc 2.31+ (Ubuntu 20.04+, Debian 11+, Fedora 33+)
    - VS Code workspace storage: `~/.config/Code/User/workspaceStorage/`
    - Database location: `~/.local/share/csm/csm.db`

## Build Requirements (Source Only)

- **Rust 1.75+** — Install via [rustup.rs](https://rustup.rs)
- **Git** — For cloning the repository
- **OpenSSL** (Linux) — `sudo apt install libssl-dev pkg-config` or equivalent

## Troubleshooting

### `command not found: chasm`

Make sure Cargo's bin directory is in your PATH:

```bash
export PATH="$HOME/.cargo/bin:$PATH"
```

### OpenSSL errors on Linux

```bash
# Ubuntu/Debian
sudo apt install libssl-dev pkg-config

# Fedora
sudo dnf install openssl-devel

# Arch
sudo pacman -S openssl
```

### Permission denied on macOS

```bash
# If downloaded binary is blocked by Gatekeeper
xattr -d com.apple.quarantine chasm
```

## Next Steps

Once installed, continue to the [Quick Start](quickstart.md) guide.
