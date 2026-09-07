//! `xcross-ios` command-line entry point.
//!
//! Dependency-free arg parsing: the surface is small (a handful of subcommands
//! with `--key value` options) and a hand-rolled parser keeps the crate free of
//! a CLI dependency, matching the rest of the crate.

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::ExitCode;

use xcross_ios::builder::{self, package_only};
use xcross_ios::config::Config;
use xcross_ios::doctor;
use xcross_ios::plist::AppMetadata;
use xcross_ios::target::Target;
use xcross_ios::{Error, Result};

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::FAILURE
        }
    }
}

fn run(args: &[String]) -> Result<()> {
    let cmd = args.first().map(String::as_str).unwrap_or("help");
    let rest = &args[args.len().min(1)..];
    match cmd {
        "doctor" => {
            print!("{}", doctor::report());
            Ok(())
        }
        "targets" => {
            for t in Target::ALL {
                println!("{:<24} arch={} sim={}", t.rust_triple(), t.arch(), t.is_simulator());
            }
            Ok(())
        }
        "build" => cmd_build(rest),
        "bundle" => cmd_bundle(rest),
        "package" => cmd_package(rest),
        "help" | "--help" | "-h" => {
            print!("{HELP}");
            Ok(())
        }
        other => Err(Error::InvalidInput(format!(
            "unknown command `{other}` (try `xcross-ios help`)"
        ))),
    }
}

/// Parse `--key value` and `--flag` pairs into maps.
struct Opts {
    values: HashMap<String, String>,
    flags: Vec<String>,
}

fn parse_opts(args: &[String]) -> Result<Opts> {
    let mut values = HashMap::new();
    let mut flags = Vec::new();
    let mut i = 0;
    while i < args.len() {
        let a = &args[i];
        if let Some(key) = a.strip_prefix("--") {
            // A following token that is not another flag is this key's value.
            if i + 1 < args.len() && !args[i + 1].starts_with("--") {
                values.insert(key.to_string(), args[i + 1].clone());
                i += 2;
            } else {
                flags.push(key.to_string());
                i += 1;
            }
        } else {
            return Err(Error::InvalidInput(format!("unexpected argument `{a}`")));
        }
    }
    Ok(Opts { values, flags })
}

impl Opts {
    fn get(&self, key: &str) -> Option<&str> {
        self.values.get(key).map(String::as_str)
    }
    fn require(&self, key: &str) -> Result<&str> {
        self.get(key)
            .ok_or_else(|| Error::InvalidInput(format!("missing required --{key}")))
    }
    fn has(&self, key: &str) -> bool {
        self.flags.iter().any(|f| f == key)
    }
}

fn metadata_from(o: &Opts) -> Result<AppMetadata> {
    Ok(AppMetadata {
        bundle_id: o.require("bundle-id")?.to_string(),
        display_name: o.require("name")?.to_string(),
        executable: o
            .get("executable-name")
            .unwrap_or_else(|| o.get("name").unwrap_or("App"))
            .to_string(),
        short_version: o.get("version").unwrap_or("1.0.0").to_string(),
        build_version: o.get("build").unwrap_or("1").to_string(),
        min_os: o.get("min-os").unwrap_or("13.0").to_string(),
    })
}

fn config_from(o: &Opts) -> Result<Config> {
    let target = Target::parse(o.get("target").unwrap_or("device"))?;
    Ok(Config {
        target,
        sdk_path: PathBuf::from(o.require("sdk")?),
        meta: metadata_from(o)?,
        out_dir: PathBuf::from(o.get("out").unwrap_or("build/ios")),
        executable: o.get("executable").map(PathBuf::from),
        crate_dir: o.get("crate").map(PathBuf::from),
        resources: o
            .get("resources")
            .map(|s| s.split(',').map(PathBuf::from).collect())
            .unwrap_or_default(),
        release: o.has("release"),
        skip_sign: o.has("no-sign"),
        entitlements: o.get("entitlements").map(PathBuf::from),
    })
}

fn cmd_build(args: &[String]) -> Result<()> {
    let o = parse_opts(args)?;
    let config = config_from(&o)?;
    let art = builder::build(&config)?;
    println!("assembled: {}", art.app.display());
    if let Some(ipa) = art.ipa {
        println!("packaged:  {}", ipa.display());
    }
    println!(
        "signed:    {}",
        if art.signed { "yes (ad-hoc/ldid)" } else { "no" }
    );
    Ok(())
}

fn cmd_bundle(args: &[String]) -> Result<()> {
    let o = parse_opts(args)?;
    // Bundle stage needs a prebuilt executable.
    let mut config = config_from(&o)?;
    if config.executable.is_none() {
        return Err(Error::InvalidInput(
            "bundle requires --executable <prebuilt Mach-O>".into(),
        ));
    }
    config.crate_dir = None;
    let app = builder::bundle_only(&config)?;
    println!("assembled: {}", app.display());
    Ok(())
}

fn cmd_package(args: &[String]) -> Result<()> {
    let o = parse_opts(args)?;
    let app = PathBuf::from(o.require("app")?);
    let ipa = PathBuf::from(
        o.get("out")
            .map(str::to_string)
            .unwrap_or_else(|| format!("{}.ipa", app.display())),
    );
    package_only(&app, &ipa)?;
    println!("packaged:  {}", ipa.display());
    Ok(())
}

const HELP: &str = "\
xcross-ios — build iOS apps off a Mac (cross-compile, bundle, pseudo-sign, package)

USAGE:
  xcross-ios <command> [options]

COMMANDS:
  doctor                 Report host readiness and what is missing.
  targets                List supported iOS build targets.
  build                  Full pipeline: (compile) -> bundle -> sign -> package.
  bundle                 Assemble a .app from a prebuilt executable.
  package                Package an existing .app into a .ipa.
  help                   Show this help.

COMMON OPTIONS:
  --target <t>           device | sim | x86_64-sim        (default: device)
  --sdk <path>           iOS SDK sysroot copied from Xcode (REQUIRED for build)
  --name <n>             App display name / .app name
  --bundle-id <id>       Reverse-DNS bundle identifier
  --version <v>          Marketing version                (default: 1.0.0)
  --build <n>            Build number                     (default: 1)
  --min-os <v>           Minimum iOS version              (default: 13.0)
  --out <dir>            Output directory                 (default: build/ios)

BUILD SOURCE (exactly one):
  --crate <dir>          Rust crate to cargo-build for the target
  --executable <path>    A prebuilt Mach-O executable to bundle
  --executable-name <n>  Binary name inside target/<triple>/<profile>/

SIGNING:
  --no-sign              Do not ldid-pseudo-sign (unsigned bundle)
  --entitlements <file>  Entitlements plist to embed (default: get-task-allow)

NOTES:
  The iOS SDK is Apple-proprietary and must be supplied by you (copied from a
  Mac). This tool produces an ad-hoc (ldid) signature suitable for a jailbroken
  device, simulator, or a later on-device free-provisioning resign — NOT an
  App-Store signature. Run `xcross-ios doctor` first.
";
