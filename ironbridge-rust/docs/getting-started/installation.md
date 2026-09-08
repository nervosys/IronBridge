# Installation

## From crates.io (Recommended)

```bash
cargo install ironbridge
```

Verify the installation:

```bash
ironbridge --version
```

## From Source

```bash
git clone https://github.com/nervosys/IronBridge.git
cd ironbridge/ironbridge-rust
cargo install --path .
```

## Pre-built Binaries

Download from [GitHub Releases](https://github.com/nervosys/IronBridge/releases):

| Platform | Architecture | Download |
|---|---|---|
| Windows | x86_64 | [ironbridge-windows-x64.zip](https://github.com/nervosys/IronBridge/releases/latest) |
| macOS | x86_64 | [ironbridge-darwin-x64.tar.gz](https://github.com/nervosys/IronBridge/releases/latest) |
| macOS | aarch64 | [ironbridge-darwin-arm64.tar.gz](https://github.com/nervosys/IronBridge/releases/latest) |
| Linux | x86_64 | [ironbridge-linux-x64.tar.gz](https://github.com/nervosys/IronBridge/releases/latest) |
| Linux | aarch64 | [ironbridge-linux-arm64.tar.gz](https://github.com/nervosys/IronBridge/releases/latest) |

### Installing from Binary

=== "Windows"

    ```powershell
    # Extract and add to PATH
    Expand-Archive ironbridge-windows-x64.zip -DestinationPath $env:LOCALAPPDATA\ironbridge
    $env:PATH += ";$env:LOCALAPPDATA\ironbridge"
    ```

=== "macOS / Linux"

    ```bash
    tar xzf ironbridge-*.tar.gz
    sudo mv ironbridge /usr/local/bin/
    ```

## Docker

```bash
docker pull ghcr.io/nervosys/IronBridge:latest
docker run -v ~/.ironbridge:/data ghcr.io/nervosys/IronBridge list workspaces
```

## Platform Notes

=== "Windows"

    - Requires Windows 10 or later
    - VS Code workspace storage: `%APPDATA%\Code\User\workspaceStorage\`
    - Database location: `%LOCALAPPDATA%\ironbridge\ironbridge.db`

=== "macOS"

    - Requires macOS 12 (Monterey) or later
    - Apple Silicon (M1/M2/M3/M4) supported natively
    - VS Code workspace storage: `~/Library/Application Support/Code/User/workspaceStorage/`
    - Database location: `~/Library/Application Support/ironbridge/ironbridge.db`

=== "Linux"

    - Requires glibc 2.31+ (Ubuntu 20.04+, Debian 11+, Fedora 33+)
    - VS Code workspace storage: `~/.config/Code/User/workspaceStorage/`
    - Database location: `~/.local/share/ironbridge/ironbridge.db`

## Build Requirements (Source Only)

- **Rust 1.75+** — Install via [rustup.rs](https://rustup.rs)
- **Git** — For cloning the repository
- **OpenSSL** (Linux) — `sudo apt install libssl-dev pkg-config` or equivalent

## Troubleshooting

### `command not found: ironbridge`

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
xattr -d com.apple.quarantine ironbridge
```

## Next Steps

Once installed, continue to the [Quick Start](quickstart.md) guide.
