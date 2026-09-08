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
        "xcode-build" => cmd_xcode_build(rest),
        "xcode-sdks" => cmd_xcode_sdks(),
        "xcode-identities" => cmd_xcode_identities(),
        "xcframework" => cmd_xcframework(rest),
        "remote-xcodebuild" => cmd_remote_xcodebuild(rest),
        "provision" => cmd_provision(rest),
        "build-settings" => cmd_build_settings(rest),
        "entitlements" => cmd_entitlements(rest),
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

fn cmd_xcode_build(args: &[String]) -> Result<()> {
    use xcross_ios::ontology::{BuildConfiguration, Destination, Platform};
    use xcross_ios::xcode::{Action, Xcodebuild};

    let o = parse_opts(args)?;
    let action = match o.get("action").unwrap_or("build") {
        "build" => Action::Build,
        "clean" => Action::Clean,
        "test" => Action::Test,
        "archive" => Action::Archive,
        "build-for-testing" => Action::BuildForTesting,
        other => return Err(Error::InvalidInput(format!("unknown --action `{other}`"))),
    };
    let mut xb = Xcodebuild::new(action);
    if let Some(w) = o.get("workspace") {
        xb = xb.workspace(w);
    } else if let Some(p) = o.get("project") {
        xb = xb.project(p);
    }
    if let Some(s) = o.get("scheme") {
        xb = xb.scheme(s);
    }
    if let Some(c) = o.get("configuration") {
        xb = xb.configuration(match c {
            "Debug" => BuildConfiguration::Debug,
            "Release" => BuildConfiguration::Release,
            other => BuildConfiguration::Custom(other.to_string()),
        });
    }
    // Destination: platform + optional simulator name/os.
    if let Some(pf) = o.get("platform") {
        let platform = Platform::from_sdk_family(pf)
            .or_else(|| match pf {
                "iOS" => Some(Platform::IOS),
                "iOS Simulator" => Some(Platform::IOSSimulator),
                _ => None,
            })
            .ok_or_else(|| Error::InvalidInput(format!("unknown --platform `{pf}`")))?;
        let dest = match o.get("device") {
            Some(name) => Destination::simulator(
                platform,
                name,
                o.get("os").and_then(xcross_ios::ontology::Version::parse),
            ),
            None => Destination::generic(platform),
        };
        xb = xb.destination(dest);
    }
    xb.skip_signing = o.has("no-sign");

    if o.has("dry-run") {
        // Print the exact command that would run — works on any host.
        println!("xcodebuild {}", shell_join(&xb.args()));
        return Ok(());
    }
    xb.run()
}

fn cmd_xcode_sdks() -> Result<()> {
    for sdk in xcross_ios::xcode::installed_sdks()? {
        println!(
            "{:<16} {:<8} -sdk {}",
            sdk.platform.destination_name(),
            sdk.version,
            sdk.canonical_name
        );
    }
    Ok(())
}

fn cmd_xcode_identities() -> Result<()> {
    for id in xcross_ios::xcode::signing_identities()? {
        println!(
            "{:<13?} {} {}",
            id.kind,
            id.sha1.as_deref().unwrap_or("-"),
            id.name
        );
    }
    Ok(())
}

fn cmd_xcframework(args: &[String]) -> Result<()> {
    use xcross_ios::ontology::{Arch, Platform};
    use xcross_ios::xcframework::{assemble, Library, Slice};

    // Non-`--slice` options go through the normal parser; `--slice` may repeat,
    // so it is scanned separately.
    let mut name: Option<String> = None;
    let mut out = PathBuf::from("build/ios");
    let mut specs: Vec<String> = Vec::new();
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--name" => {
                name = args.get(i + 1).cloned();
                i += 2;
            }
            "--out" => {
                if let Some(v) = args.get(i + 1) {
                    out = PathBuf::from(v);
                }
                i += 2;
            }
            "--slice" => {
                if let Some(v) = args.get(i + 1) {
                    specs.push(v.clone());
                }
                i += 2;
            }
            other => return Err(Error::InvalidInput(format!("unexpected argument `{other}`"))),
        }
    }
    let name = name.ok_or_else(|| Error::InvalidInput("xcframework requires --name".into()))?;
    if specs.is_empty() {
        return Err(Error::InvalidInput(
            "provide at least one --slice <platform>;<arch[,arch]>;<lib>[;<headers>]".into(),
        ));
    }

    let mut slices = Vec::new();
    for spec in &specs {
        // platform;archs;lib[;headers] — `;` (not `:`) so Windows drive-letter
        // paths like C:/… survive intact.
        let parts: Vec<&str> = spec.split(';').collect();
        if parts.len() < 3 {
            return Err(Error::InvalidInput(format!(
                "malformed --slice `{spec}` (want platform;arch[,arch];lib[;headers])"
            )));
        }
        let platform = Platform::from_sdk_family(parts[0]).ok_or_else(|| {
            Error::InvalidInput(format!("unknown slice platform `{}`", parts[0]))
        })?;
        let archs: Result<Vec<Arch>> = parts[1]
            .split(',')
            .map(|a| Arch::parse(a).ok_or_else(|| Error::InvalidInput(format!("bad arch `{a}`"))))
            .collect();
        let lib = PathBuf::from(parts[2]);
        // A `.framework` directory vs a static `.a`.
        let library = if lib.extension().and_then(|e| e.to_str()) == Some("framework")
            || lib.is_dir()
        {
            Library::Framework(lib)
        } else {
            Library::StaticLib {
                lib,
                headers: parts.get(3).map(PathBuf::from),
            }
        };
        slices.push(Slice {
            platform,
            archs: archs?,
            library,
        });
    }

    let path = assemble(&name, &slices, &out)?;
    println!("assembled: {}", path.display());
    for s in &slices {
        println!("  slice: {}", s.identifier());
    }
    Ok(())
}

fn cmd_remote_xcodebuild(args: &[String]) -> Result<()> {
    use xcross_ios::ontology::{BuildConfiguration, Destination, Platform};
    use xcross_ios::remote::{RemoteHost, RemoteXcode};
    use xcross_ios::xcode::{Action, Xcodebuild};

    let o = parse_opts(args)?;
    // Remote host.
    let mut host = RemoteHost::new(o.require("host")?);
    if let Some(u) = o.get("user") {
        host = host.user(u);
    }
    if let Some(p) = o.get("port") {
        host = host.port(
            p.parse()
                .map_err(|_| Error::InvalidInput(format!("bad --port `{p}`")))?,
        );
    }
    if let Some(i) = o.get("identity") {
        host = host.identity(i);
    }
    if o.has("insecure") {
        host.strict_host_key_checking = false;
    }
    let workdir = o.get("workdir").unwrap_or("~").to_string();
    let rx = RemoteXcode::new(host, workdir);

    // The xcodebuild to run remotely.
    let action = match o.get("action").unwrap_or("build") {
        "build" => Action::Build,
        "clean" => Action::Clean,
        "test" => Action::Test,
        "archive" => Action::Archive,
        "build-for-testing" => Action::BuildForTesting,
        other => return Err(Error::InvalidInput(format!("unknown --action `{other}`"))),
    };
    let mut xb = Xcodebuild::new(action);
    if let Some(w) = o.get("workspace") {
        xb = xb.workspace(w);
    } else if let Some(p) = o.get("project") {
        xb = xb.project(p);
    }
    if let Some(s) = o.get("scheme") {
        xb = xb.scheme(s);
    }
    if let Some(c) = o.get("configuration") {
        xb = xb.configuration(match c {
            "Debug" => BuildConfiguration::Debug,
            "Release" => BuildConfiguration::Release,
            other => BuildConfiguration::Custom(other.to_string()),
        });
    }
    if let Some(pf) = o.get("platform") {
        let platform = Platform::from_sdk_family(pf)
            .or_else(|| match pf {
                "iOS" => Some(Platform::IOS),
                "iOS Simulator" => Some(Platform::IOSSimulator),
                _ => None,
            })
            .ok_or_else(|| Error::InvalidInput(format!("unknown --platform `{pf}`")))?;
        xb = xb.destination(Destination::generic(platform));
    }
    xb.skip_signing = o.has("no-sign");

    if o.has("dry-run") {
        println!("{}", shell_join(&rx.xcodebuild_ssh_args(&xb)));
        return Ok(());
    }
    rx.run_xcodebuild(&xb)
}

fn cmd_provision(args: &[String]) -> Result<()> {
    use xcross_ios::provision::ParsedProfile;
    let file = args
        .first()
        .filter(|a| !a.starts_with("--"))
        .ok_or_else(|| Error::InvalidInput("usage: provision <file.mobileprovision>".into()))?;
    let p = ParsedProfile::from_file(std::path::Path::new(file))?;
    println!("Name:              {}", p.name);
    println!("UUID:              {}", p.uuid);
    println!("Team:              {} ({})", p.team_name.as_deref().unwrap_or("-"), p.team_ids.join(","));
    println!("App ID name:       {}", p.app_id_name.as_deref().unwrap_or("-"));
    println!("Platforms:         {}", p.platforms.join(", "));
    println!("App identifier:    {}", p.application_identifier.as_deref().unwrap_or("-"));
    println!("Created:           {}", p.creation_date.as_deref().unwrap_or("-"));
    println!("Expires:           {}", p.expiration_date.as_deref().unwrap_or("-"));
    println!("Xcode managed:     {}", p.xcode_managed);
    println!(
        "Type:              {}",
        if p.is_distribution() { "distribution (no device list)" } else { "development" }
    );
    println!("Provisioned devices: {}", p.provisioned_devices.len());
    println!("Entitlements ({}):  {}", p.entitlement_keys.len(), p.entitlement_keys.join(", "));
    Ok(())
}

fn cmd_build_settings(args: &[String]) -> Result<()> {
    use xcross_ios::build_settings::BuildSettings;
    let o = parse_opts(args)?;

    // Either parse a captured dump (works anywhere) or run it on a Mac.
    let settings = if let Some(file) = o.get("file") {
        let text = std::fs::read_to_string(file)
            .map_err(|e| Error::io(format!("reading {file}"), e))?;
        BuildSettings::parse(&text)
    } else {
        use xcross_ios::xcode::{show_build_settings, Action, Xcodebuild};
        let mut xb = Xcodebuild::new(Action::Build);
        if let Some(w) = o.get("workspace") {
            xb = xb.workspace(w);
        } else if let Some(p) = o.get("project") {
            xb = xb.project(p);
        }
        if let Some(s) = o.get("scheme") {
            xb = xb.scheme(s);
        }
        show_build_settings(&xb)?
    };

    println!("parsed {} settings", settings.len());
    println!("  bundle id:     {}", settings.bundle_identifier().unwrap_or("-"));
    println!("  product name:  {}", settings.full_product_name().unwrap_or("-"));
    println!("  executable:    {}", settings.executable_name().unwrap_or("-"));
    println!("  build dir:     {}", settings.configuration_build_dir().unwrap_or("-"));
    match settings.product_path() {
        Some(p) => println!("  product path:  {}", p.display()),
        None => println!("  product path:  (unresolved — need CONFIGURATION_BUILD_DIR + FULL_PRODUCT_NAME)"),
    }
    // If a specific --key was requested, print it too.
    if let Some(key) = o.get("key") {
        println!("  {key} = {}", settings.get(key).unwrap_or("(unset)"));
    }
    Ok(())
}

fn cmd_entitlements(args: &[String]) -> Result<()> {
    use xcross_ios::entitlements::diff;
    use xcross_ios::plist_read::Plist;
    use xcross_ios::provision::ParsedProfile;

    let o = parse_opts(args)?;
    // The app's requested entitlements: a .entitlements plist file.
    let app_file = o.require("app")?;
    let app_xml = std::fs::read_to_string(app_file)
        .map_err(|e| Error::io(format!("reading {app_file}"), e))?;
    let app = Plist::parse(&app_xml)?;

    // The profile's granted entitlements, extracted from a .mobileprovision.
    let profile_file = o.require("profile")?;
    let profile = ParsedProfile::from_file(std::path::Path::new(profile_file))?;
    let granted = profile
        .entitlements
        .as_ref()
        .ok_or_else(|| Error::InvalidInput("profile has no Entitlements dict".into()))?;

    let report = diff(&app, granted);
    println!("checked {} app entitlement(s) against profile `{}`", report.checked, profile.name);
    if report.is_satisfiable() {
        println!("OK: the profile satisfies every requested entitlement.");
    } else {
        println!("{} problem(s):", report.findings.len());
        for f in &report.findings {
            println!("  - {}", f.explain());
        }
        // A non-zero exit signals a would-fail signing to scripts/CI.
        return Err(Error::InvalidInput(
            "entitlements are not satisfied by the profile".into(),
        ));
    }
    Ok(())
}

/// Join args for display, quoting any that contain spaces.
fn shell_join(args: &[String]) -> String {
    args.iter()
        .map(|a| {
            if a.contains(' ') {
                format!("\"{a}\"")
            } else {
                a.clone()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
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
  xcode-build            Drive `xcodebuild` via the typed wrapper (--dry-run to
                         print the command; runs it on a Mac otherwise).
  xcode-sdks             List installed SDKs (parses `xcodebuild -showsdks`; Mac).
  xcode-identities       List code-signing identities (`security`; Mac).
  xcframework            Assemble a .xcframework from per-slice libs (any host).
  remote-xcodebuild      Run xcodebuild on a remote Mac over SSH.
  provision <file>       Parse a .mobileprovision and print its fields (any host).
  entitlements           Check an app's --app <.entitlements> against a
                         --profile <.mobileprovision>; non-zero exit if a
                         requested entitlement is missing/mismatched (any host).
  build-settings         Parse `xcodebuild -showBuildSettings`. --file <dump>
                         parses a capture (any host); else runs on a Mac via
                         --workspace/--project + --scheme. --key <K> prints one.
  help                   Show this help.

REMOTE-XCODEBUILD OPTIONS:
  --host <h>             Remote Mac hostname/IP           (required)
  --user <u>  --port <n>  --identity <keyfile>  --insecure (no host-key check)
  --workdir <dir>        Remote project directory         (default: ~)
  (plus the XCODE-BUILD OPTIONS above; --dry-run prints the ssh command)

XCFRAMEWORK OPTIONS:
  --name <n>             Output <n>.xcframework
  --out <dir>            Output directory                 (default: build/ios)
  --slice <spec>         Repeatable. spec = platform;arch[,arch];lib[;headers]
                         (';'-separated so Windows drive paths survive), e.g.
                         iphoneos;arm64;libchasm.a;include
                         iphonesimulator;arm64,x86_64;libchasm-sim.a;include

XCODE-BUILD OPTIONS:
  --action <a>           build | clean | test | archive | build-for-testing
  --workspace <p> | --project <p>
  --scheme <s>  --configuration <Debug|Release|...>
  --platform <p>  --device <name>  --os <ver>   (destination)
  --no-sign      Add CODE_SIGNING_ALLOWED=NO (CI compile checks)
  --dry-run      Print the xcodebuild command instead of running it

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
