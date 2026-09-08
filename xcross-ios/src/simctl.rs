//! A wrapper for `xcrun simctl` — the iOS simulator control tool.
//!
//! Same split as the rest of the crate: the `simctl list` parser and the
//! command builders (`boot`, `install`, `launch`, …) are pure and unit-tested
//! on any host; the runners spawn `xcrun` and need a Mac. This lets you script
//! "boot a simulator, install the .app, launch it" from Windows and run it on a
//! Mac unchanged.

use crate::error::{Error, Result};
use crate::process;

/// A simulator device's lifecycle state.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SimState {
    /// Ready to install/launch.
    Booted,
    /// Powered off.
    Shutdown,
    /// Transitioning up.
    Booting,
    /// Transitioning down.
    ShuttingDown,
    /// Anything else `simctl` prints.
    Other(String),
}

impl SimState {
    /// Parse the parenthesized state word(s).
    pub fn parse(s: &str) -> SimState {
        match s.trim() {
            "Booted" => SimState::Booted,
            "Shutdown" => SimState::Shutdown,
            "Booting" => SimState::Booting,
            "Shutting Down" => SimState::ShuttingDown,
            other => SimState::Other(other.to_string()),
        }
    }
}

/// A simulator device.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SimDevice {
    /// Display name, e.g. `iPhone 15 Pro`.
    pub name: String,
    /// The device UDID.
    pub udid: String,
    /// Current state.
    pub state: SimState,
    /// The runtime header it appeared under, e.g. `iOS 17.4`.
    pub runtime: String,
}

impl SimDevice {
    /// A convenience: is this device booted?
    pub fn is_booted(&self) -> bool {
        self.state == SimState::Booted
    }
}

/// Parse the plain-text output of `xcrun simctl list devices`.
///
/// The format is a `-- <runtime> --` header followed by indented
/// `Name (UDID) (State)` lines. Unavailable runtimes and unparseable lines are
/// skipped.
pub fn parse_list_devices(text: &str) -> Vec<SimDevice> {
    let mut devices = Vec::new();
    let mut runtime = String::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(inner) = trimmed.strip_prefix("-- ").and_then(|s| s.strip_suffix(" --")) {
            runtime = inner.to_string();
            continue;
        }
        if runtime.is_empty() || trimmed.is_empty() || trimmed.starts_with("==") {
            continue;
        }
        if let Some(dev) = parse_device_line(trimmed, &runtime) {
            devices.push(dev);
        }
    }
    devices
}

/// Parse one `Name (UDID) (State)` line.
fn parse_device_line(line: &str, runtime: &str) -> Option<SimDevice> {
    // The last two parenthesized groups are (UDID) and (State). Parse from the
    // right so a name containing parentheses does not confuse it.
    let state_open = line.rfind('(')?;
    let state_close = line.rfind(')')?;
    if state_close < state_open {
        return None;
    }
    let state = &line[state_open + 1..state_close];

    let rest = line[..state_open].trim_end();
    let udid_open = rest.rfind('(')?;
    let udid_close = rest.rfind(')')?;
    if udid_close < udid_open {
        return None;
    }
    let udid = &rest[udid_open + 1..udid_close];
    // A UDID is a UUID; a quick shape check rejects non-device lines.
    if !looks_like_udid(udid) {
        return None;
    }
    let name = rest[..udid_open].trim();
    if name.is_empty() {
        return None;
    }
    Some(SimDevice {
        name: name.to_string(),
        udid: udid.to_string(),
        state: SimState::parse(state),
        runtime: runtime.to_string(),
    })
}

/// A loose UUID shape check (8-4-4-4-12 hex with dashes).
fn looks_like_udid(s: &str) -> bool {
    let groups: Vec<&str> = s.split('-').collect();
    let lengths: Vec<usize> = groups.iter().map(|g| g.len()).collect();
    lengths == [8usize, 4, 4, 4, 12]
        && groups.iter().all(|g| g.bytes().all(|b| b.is_ascii_hexdigit()))
}

// ============================================================================
// Command builders (pure)
// ============================================================================

/// `xcrun simctl list devices` argv.
pub fn list_devices_args() -> Vec<String> {
    vec!["simctl".into(), "list".into(), "devices".into()]
}

/// `xcrun simctl boot <udid>` argv.
pub fn boot_args(udid: &str) -> Vec<String> {
    vec!["simctl".into(), "boot".into(), udid.into()]
}

/// `xcrun simctl shutdown <udid>` argv.
pub fn shutdown_args(udid: &str) -> Vec<String> {
    vec!["simctl".into(), "shutdown".into(), udid.into()]
}

/// `xcrun simctl install <udid> <app_path>` argv.
pub fn install_args(udid: &str, app_path: &str) -> Vec<String> {
    vec![
        "simctl".into(),
        "install".into(),
        udid.into(),
        app_path.into(),
    ]
}

/// `xcrun simctl launch <udid> <bundle_id>` argv.
pub fn launch_args(udid: &str, bundle_id: &str) -> Vec<String> {
    vec![
        "simctl".into(),
        "launch".into(),
        udid.into(),
        bundle_id.into(),
    ]
}

// ============================================================================
// Execution (needs a Mac)
// ============================================================================

/// List simulator devices (`xcrun simctl list devices`), parsed.
pub fn list_devices() -> Result<Vec<SimDevice>> {
    let args = list_devices_args();
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = run_xcrun_capture(&refs)?;
    Ok(parse_list_devices(&out))
}

/// Run a `simctl` argv (via `xcrun`), streaming output.
pub fn run(argv: &[String]) -> Result<()> {
    let refs: Vec<&str> = argv.iter().map(String::as_str).collect();
    let mut full = vec!["xcrun"];
    full.extend(refs);
    process::run("xcrun", &full[1..]).map_err(map_missing)
}

fn run_xcrun_capture(args: &[&str]) -> Result<String> {
    process::capture("xcrun", args).map_err(map_missing)
}

fn map_missing(e: Error) -> Error {
    match e {
        Error::Io { source, .. } if source.kind() == std::io::ErrorKind::NotFound => {
            Error::ToolMissing {
                tool: "xcrun/simctl".into(),
                hint: "the iOS simulator tools are macOS-only; run on a Mac. The parser and \
                       command builders work anywhere."
                    .into(),
            }
        }
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = concat!(
        "== Devices ==\n",
        "-- iOS 17.4 --\n",
        "    iPhone 15 (A1111111-2222-3333-4444-555555555555) (Shutdown)\n",
        "    iPhone 15 Pro (B1111111-2222-3333-4444-555555555555) (Booted)\n",
        "-- iOS 16.4 --\n",
        "    iPhone SE (3rd generation) (C1111111-2222-3333-4444-555555555555) (Shutdown)\n",
        "-- Unavailable: com.apple.CoreSimulator.SimRuntime.tvOS-17-4 --\n",
        "    Apple TV (D1111111-2222-3333-4444-555555555555) (Shutdown)\n",
    );

    #[test]
    fn parses_devices_with_state_and_runtime() {
        let devs = parse_list_devices(SAMPLE);
        assert_eq!(devs.len(), 4);
        assert_eq!(devs[0].name, "iPhone 15");
        assert_eq!(devs[0].state, SimState::Shutdown);
        assert_eq!(devs[0].runtime, "iOS 17.4");
        assert_eq!(devs[1].name, "iPhone 15 Pro");
        assert!(devs[1].is_booted());
        // A name containing parentheses is parsed correctly.
        assert_eq!(devs[2].name, "iPhone SE (3rd generation)");
        assert_eq!(devs[2].runtime, "iOS 16.4");
    }

    #[test]
    fn the_only_booted_device_can_be_found() {
        let booted: Vec<_> = parse_list_devices(SAMPLE)
            .into_iter()
            .filter(SimDevice::is_booted)
            .collect();
        assert_eq!(booted.len(), 1);
        assert_eq!(booted[0].name, "iPhone 15 Pro");
    }

    #[test]
    fn command_builders_produce_the_expected_argv() {
        assert_eq!(boot_args("UDID"), vec!["simctl", "boot", "UDID"]);
        assert_eq!(
            install_args("UDID", "/tmp/Chasm.app"),
            vec!["simctl", "install", "UDID", "/tmp/Chasm.app"]
        );
        assert_eq!(
            launch_args("UDID", "com.nervosys.csm"),
            vec!["simctl", "launch", "UDID", "com.nervosys.csm"]
        );
    }

    #[test]
    fn non_device_lines_are_ignored() {
        // A stray line without a UDID must not become a device.
        let devs = parse_list_devices("-- iOS 17.4 --\n    (no devices)\n");
        assert!(devs.is_empty());
    }
}
